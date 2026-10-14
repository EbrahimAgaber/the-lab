import crypto from 'node:crypto';
import type { SqlDatabase } from '../db';
import type { Clock, IdGenerator } from '../runtime';
import { AuditService } from './audit';
import type {
  CompleteSetupDto,
  LoginDto,
  LoginResultDto,
  SessionContext,
  SetupStateDto,
  UserDto,
} from '@the-lab/contract';
import { RpcError } from '@the-lab/contract';

export class SecurityService {
  private audit: AuditService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {
    this.audit = new AuditService(db, clock, ids);
  }

  // --- Password Hashing & Verification (scrypt with crypto) ---
  public hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
  }

  // --- Setup Wizard ---
  public getSetupState(): SetupStateDto {
    const profile = this.db
      .prepare('SELECT name_ar, name_en, base_currency, is_setup_complete FROM company_profile WHERE id = ?')
      .get('default') as
      | {
          name_ar: string;
          name_en: string;
          base_currency: string;
          is_setup_complete: number;
        }
      | undefined;

    const userCount = (
      this.db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }
    )?.cnt ?? 0;

    const isSetupComplete = Boolean(profile && profile.is_setup_complete === 1 && userCount > 0);

    return {
      isSetupComplete,
      companyNameAr: profile?.name_ar || undefined,
      companyNameEn: profile?.name_en || undefined,
      baseCurrency: profile?.base_currency || 'SAR',
    };
  }

  public completeSetup(dto: CompleteSetupDto): { success: boolean; user: UserDto } {
    const state = this.getSetupState();
    if (state.isSetupComplete) {
      throw new RpcError('CONFLICT', 'errors.setupAlreadyCompleted', 'Setup has already been completed.');
    }

    const now = this.clock.now().toISOString();
    const adminId = this.ids.next();
    const { hash, salt } = this.hashPassword(dto.adminPassword);

    const tx = this.db.transaction(() => {
      // 1. Update Company Profile
      this.db
        .prepare(
          `UPDATE company_profile
           SET name_ar = ?, name_en = ?, cr_number = ?, vat_number = ?, base_currency = ?, vat_rate_pct = ?, is_setup_complete = 1, updated_at = ?
           WHERE id = 'default'`,
        )
        .run(
          dto.companyNameAr,
          dto.companyNameEn,
          dto.crNumber || null,
          dto.vatNumber || null,
          dto.baseCurrency,
          dto.vatRatePct,
          now,
        );

      // 2. Create Initial Administrator User
      this.db
        .prepare(
          `INSERT INTO users (id, username, display_name, password_hash, password_salt, must_change_password, is_active, language, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`,
        )
        .run(
          adminId,
          dto.adminUsername.trim().toLowerCase(),
          dto.adminDisplayName.trim(),
          hash,
          salt,
          dto.defaultLanguage,
          now,
          now,
        );

      // 3. Assign ADMIN Role
      this.db.prepare('INSERT INTO user_roles (user_id, role_code) VALUES (?, ?)').run(adminId, 'ADMIN');

      // 4. Audit Log
      this.audit.record({
        actorId: adminId,
        action: 'system.setup.completed',
        entityType: 'company_profile',
        entityId: 'default',
        diff: { companyNameAr: dto.companyNameAr, adminUsername: dto.adminUsername },
      });
    });

    tx();

    return {
      success: true,
      user: {
        id: adminId,
        username: dto.adminUsername.trim().toLowerCase(),
        display_name: dto.adminDisplayName.trim(),
        is_active: true,
        must_change_password: false,
        language: dto.defaultLanguage || 'ar',
        roles: ['ADMIN'],
        created_at: now,
      },
    };
  }

  // --- Authentication ---
  public login(dto: LoginDto): LoginResultDto {
    const user = this.db
      .prepare('SELECT id, username, display_name, password_hash, password_salt, is_active, must_change_password, language, created_at FROM users WHERE username = ?')
      .get(dto.username.trim().toLowerCase()) as
      | {
          id: string;
          username: string;
          display_name: string;
          password_hash: string;
          password_salt: string;
          is_active: number;
          must_change_password: number;
          language: string;
          created_at: string;
        }
      | undefined;

    if (!user || !user.is_active) {
      throw new RpcError('UNAUTHENTICATED', 'errors.invalidCredentials', 'Invalid username or password.');
    }

    const isValid = this.verifyPassword(dto.password, user.password_hash, user.password_salt);
    if (!isValid) {
      throw new RpcError('UNAUTHENTICATED', 'errors.invalidCredentials', 'Invalid username or password.');
    }

    // Load roles & capabilities
    const rolesRows = this.db
      .prepare('SELECT role_code FROM user_roles WHERE user_id = ?')
      .all(user.id) as { role_code: string }[];
    const roles = rolesRows.map((r) => r.role_code);

    const capabilities = this.getCapabilitiesForRoles(roles);

    // Create session token (expires in 7 days)
    const token = crypto.randomBytes(32).toString('hex');
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    this.db
      .prepare('INSERT INTO sessions (token, user_id, expires_at, last_seen_at) VALUES (?, ?, ?, ?)')
      .run(token, user.id, expiresAt, now.toISOString());

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        is_active: Boolean(user.is_active),
        must_change_password: Boolean(user.must_change_password),
        language: user.language,
        roles,
        created_at: user.created_at,
      },
      capabilities,
    };
  }

  public logout(token: string): boolean {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return true;
  }

  public getSession(token?: string): SessionContext | null {
    if (!token) return null;

    const row = this.db
      .prepare(
        `SELECT s.token, s.expires_at, u.id, u.username, u.display_name, u.is_active
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ?`,
      )
      .get(token) as
      | {
          token: string;
          expires_at: string;
          id: string;
          username: string;
          display_name: string;
          is_active: number;
        }
      | undefined;

    if (!row || !row.is_active) return null;

    const expiresAt = new Date(row.expires_at).getTime();
    if (Date.now() > expiresAt) {
      this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return null;
    }

    // Refresh last_seen_at
    this.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?').run(new Date().toISOString(), token);

    const rolesRows = this.db
      .prepare('SELECT role_code FROM user_roles WHERE user_id = ?')
      .all(row.id) as { role_code: string }[];
    const roles = rolesRows.map((r) => r.role_code);
    const capabilities = this.getCapabilitiesForRoles(roles);

    return {
      userId: row.id,
      username: row.username,
      displayName: row.display_name,
      roles,
      capabilities,
    };
  }

  public getCapabilitiesForRoles(roles: string[]): string[] {
    if (roles.length === 0) return [];
    if (roles.includes('ADMIN')) return ['*:*.*'];

    const placeholders = roles.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT DISTINCT capability FROM role_capabilities WHERE role_code IN (${placeholders})`)
      .all(...roles) as { capability: string }[];

    return rows.map((r) => r.capability);
  }

  public checkCapability(session: SessionContext | null, requiredCap: string): boolean {
    if (!session) return false;
    if (session.capabilities.includes('*:*.*')) return true;

    // Pattern matching e.g. "manufacturing:*.*" matches "manufacturing:workOrders.create"
    for (const cap of session.capabilities) {
      if (cap === requiredCap) return true;
      if (cap.endsWith(':*.*')) {
        const domain = cap.split(':')[0];
        if (requiredCap.startsWith(`${domain}:`)) return true;
      }
      if (cap.endsWith('.*')) {
        const prefix = cap.slice(0, -2);
        if (requiredCap.startsWith(prefix)) return true;
      }
    }

    return false;
  }
}
