import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // v29.7.0
import { faker } from '@faker-js/faker'; // v8.0.0
import {
  validateEmail,
  validatePassword,
  validateFileUpload,
  sanitizeString
} from '../../src/utils/validation';
import { VALIDATION_CONSTANTS } from '../../src/config/constants';

describe('validateEmail', () => {
  it('should validate standard email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.com',
      'user+tag@domain.com',
      faker.internet.email()
    ];

    validEmails.forEach(email => {
      expect(validateEmail(email)).toEqual([]);
    });
  });

  it('should validate subdomain email formats', () => {
    const validSubdomainEmails = [
      'test@sub.domain.com',
      'user@department.company.co.uk',
      faker.internet.email({ provider: 'sub.domain.com' })
    ];

    validSubdomainEmails.forEach(email => {
      expect(validateEmail(email)).toEqual([]);
    });
  });

  it('should reject invalid email formats', () => {
    const invalidEmails = [
      '',
      'test',
      '@domain.com',
      'test@',
      'test@.com',
      'test@domain',
      'test@domain.',
      'test@domain.c',
      'test@domain..com'
    ];

    invalidEmails.forEach(email => {
      expect(validateEmail(email)).toHaveLength(1);
      expect(validateEmail(email)[0].field).toBe('email');
    });
  });

  it('should handle SQL injection patterns', () => {
    const sqlInjectionEmails = [
      "test'--@domain.com",
      'test;DROP TABLE users;--@domain.com',
      "test' OR '1'='1@domain.com"
    ];

    sqlInjectionEmails.forEach(email => {
      expect(validateEmail(email)).toHaveLength(1);
    });
  });

  it('should handle XSS patterns', () => {
    const xssEmails = [
      'test<script>@domain.com',
      'test@domain.com<script>alert(1)</script>',
      'test@domain.com">alert(1)'
    ];

    xssEmails.forEach(email => {
      expect(validateEmail(email)).toHaveLength(1);
    });
  });
});

describe('validatePassword', () => {
  it('should validate passwords meeting all requirements', () => {
    const validPasswords = [
      'Test123!@#',
      'SecureP@ssw0rd',
      'Complex1ty!',
      faker.internet.password({ length: 12, pattern: /[A-Za-z0-9!@#$%^&*]/ })
    ];

    validPasswords.forEach(password => {
      expect(validatePassword(password)).toEqual([]);
    });
  });

  it('should enforce minimum length requirement', () => {
    const shortPassword = 'Ab1!';
    const errors = validatePassword(shortPassword);
    
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH.toString());
  });

  it('should enforce maximum length requirement', () => {
    const longPassword = faker.string.alphanumeric(VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH + 1);
    const errors = validatePassword(longPassword);
    
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH.toString());
  });

  it('should require all character types', () => {
    const invalidPasswords = [
      'onlylowercase',
      'ONLYUPPERCASE',
      'NoSpecialChars123',
      'NoNumbers!!!'
    ];

    invalidPasswords.forEach(password => {
      const errors = validatePassword(password);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('should detect common password patterns', () => {
    const commonPasswords = [
      'Password123!',
      'Qwerty123!',
      '12345678Ab!',
      'password1A!'
    ];

    commonPasswords.forEach(password => {
      const errors = validatePassword(password);
      expect(errors.some(e => e.message.includes('common patterns'))).toBe(true);
    });
  });
});

describe('validateFileUpload', () => {
  let mockValidFile: File;
  let mockInvalidFile: File;

  beforeEach(() => {
    const validContent = new Uint8Array([1, 2, 3, 4]);
    mockValidFile = new File([validContent], 'test.pdf', {
      type: 'application/pdf',
      lastModified: Date.now()
    });

    mockInvalidFile = new File([validContent], 'test.exe', {
      type: 'application/x-msdownload',
      lastModified: Date.now()
    });
  });

  it('should validate allowed file types', () => {
    const errors = validateFileUpload(mockValidFile);
    expect(errors).toEqual([]);
  });

  it('should reject files exceeding size limit', () => {
    const largeContent = new Uint8Array(VALIDATION_CONSTANTS.MAX_FILE_SIZE + 1000);
    const largeFile = new File([largeContent], 'large.pdf', {
      type: 'application/pdf'
    });

    const errors = validateFileUpload(largeFile);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('size');
  });

  it('should reject disallowed file types', () => {
    const errors = validateFileUpload(mockInvalidFile);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('type');
  });

  it('should validate file MIME types', () => {
    const invalidMimeFile = new File(['content'], 'test.pdf', {
      type: 'text/plain'
    });

    const errors = validateFileUpload(invalidMimeFile);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('content type');
  });

  it('should detect malicious file extensions', () => {
    const maliciousFiles = [
      new File(['content'], 'test.exe.pdf', { type: 'application/pdf' }),
      new File(['content'], 'test.pdf.exe', { type: 'application/pdf' }),
      new File(['content'], 'test.js.pdf', { type: 'application/pdf' })
    ];

    maliciousFiles.forEach(file => {
      const errors = validateFileUpload(file);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('sanitizeString', () => {
  it('should remove HTML tags', () => {
    const input = '<p>Test</p><div>Content</div>';
    expect(sanitizeString(input)).toBe('TestContent');
  });

  it('should remove script tags and content', () => {
    const input = 'Before<script>alert("xss")</script>After';
    expect(sanitizeString(input)).toBe('BeforeAfter');
  });

  it('should remove SQL injection patterns', () => {
    const sqlPatterns = [
      "DROP TABLE users;",
      "SELECT * FROM users;",
      "1'; DELETE FROM users; --"
    ];

    sqlPatterns.forEach(pattern => {
      const sanitized = sanitizeString(pattern);
      expect(sanitized).not.toContain('SELECT');
      expect(sanitized).not.toContain('DROP');
      expect(sanitized).not.toContain('DELETE');
    });
  });

  it('should escape special characters', () => {
    const input = '<>&"\'/';
    const sanitized = sanitizeString(input);
    
    expect(sanitized).toContain('&lt;');
    expect(sanitized).toContain('&gt;');
    expect(sanitized).toContain('&amp;');
    expect(sanitized).toContain('&quot;');
    expect(sanitized).toContain('&#x27;');
    expect(sanitized).toContain('&#x2F;');
  });

  it('should handle nested malicious patterns', () => {
    const input = '<div><script>alert("xss")</script><style>body{display:none}</style><sql>DROP TABLE users;</sql></div>';
    const sanitized = sanitizeString(input);
    
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('<style>');
    expect(sanitized).not.toContain('<sql>');
    expect(sanitized).not.toContain('DROP TABLE');
  });

  it('should handle empty and null inputs', () => {
    expect(sanitizeString('')).toBe('');
    expect(sanitizeString(null as unknown as string)).toBe('');
    expect(sanitizeString(undefined as unknown as string)).toBe('');
  });

  it('should handle large inputs efficiently', () => {
    const largeInput = faker.string.alpha(10000);
    const start = performance.now();
    sanitizeString(largeInput);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100); // Should process within 100ms
  });
});