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
  it('should validate correct email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@domain.com',
      'a@b.cc',
      faker.internet.email()
    ];

    validEmails.forEach(email => {
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
      'test@domain..com',
      'test@domain.c',
      null,
      undefined
    ];

    invalidEmails.forEach(email => {
      expect(validateEmail(email as string).length).toBeGreaterThan(0);
    });
  });

  it('should handle email security patterns', () => {
    const maliciousEmails = [
      "test@domain.com'--",
      'test@domain.com<script>',
      `test@domain.com${'\u0000'}`,
      'test@domain.com;drop table users',
      '"><script>alert(1)</script>@domain.com'
    ];

    maliciousEmails.forEach(email => {
      expect(validateEmail(email).length).toBeGreaterThan(0);
    });
  });

  it('should validate international email formats', () => {
    const internationalEmails = [
      'user@domain.香港',
      'user@domäin.de',
      'user@домен.рф',
      'user@도메인.한국'
    ];

    internationalEmails.forEach(email => {
      expect(validateEmail(email)).toEqual([]);
    });
  });
});

describe('validatePassword', () => {
  it('should validate passwords meeting all requirements', () => {
    const validPasswords = [
      'Test123!@#',
      'SecureP@ssw0rd',
      'C0mpl3x!Pass',
      faker.internet.password({ length: 12, pattern: /[A-Za-z0-9!@#$%^&*]/ })
    ];

    validPasswords.forEach(password => {
      expect(validatePassword(password)).toEqual([]);
    });
  });

  it('should enforce minimum length requirement', () => {
    const shortPassword = 'Ab1!';
    const errors = validatePassword(shortPassword);
    
    expect(errors).toContainEqual({
      field: 'password',
      message: `Password must be at least ${VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH} characters long`
    });
  });

  it('should enforce maximum length requirement', () => {
    const longPassword = 'A'.repeat(VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH + 1);
    const errors = validatePassword(longPassword);
    
    expect(errors).toContainEqual({
      field: 'password',
      message: `Password cannot exceed ${VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH} characters`
    });
  });

  it('should require all character types', () => {
    const testCases = [
      { password: 'lowercase123!', missing: 'uppercase' },
      { password: 'UPPERCASE123!', missing: 'lowercase' },
      { password: 'UpperLower!@#', missing: 'number' },
      { password: 'UpperLower123', missing: 'special' }
    ];

    testCases.forEach(({ password, missing }) => {
      const errors = validatePassword(password);
      expect(errors.some(e => e.message.includes(missing))).toBeTruthy();
    });
  });

  it('should detect common password patterns', () => {
    const commonPasswords = [
      'Password123!',
      'Qwerty123!',
      '12345678Ab!',
      'Admin123!@#'
    ];

    commonPasswords.forEach(password => {
      const errors = validatePassword(password);
      expect(errors.some(e => e.message.includes('common patterns'))).toBeTruthy();
    });
  });
});

describe('validateFileUpload', () => {
  let mockValidFile: File;
  let mockInvalidFile: File;

  beforeEach(() => {
    const validContent = new Uint8Array([1, 2, 3, 4]);
    const invalidContent = new Uint8Array([1, 2, 3, 4]);

    mockValidFile = new File([validContent], 'test.pdf', {
      type: 'application/pdf',
      lastModified: Date.now()
    });

    mockInvalidFile = new File([invalidContent], 'test.exe', {
      type: 'application/x-msdownload',
      lastModified: Date.now()
    });
  });

  it('should validate allowed file types', () => {
    expect(validateFileUpload(mockValidFile)).toEqual([]);
  });

  it('should reject disallowed file types', () => {
    const errors = validateFileUpload(mockInvalidFile);
    expect(errors.some(e => e.message.includes('File type not allowed'))).toBeTruthy();
  });

  it('should enforce file size limits', () => {
    const largeFile = new File([new ArrayBuffer(VALIDATION_CONSTANTS.MAX_FILE_SIZE + 1000)], 'large.pdf', {
      type: 'application/pdf'
    });

    const errors = validateFileUpload(largeFile);
    expect(errors.some(e => e.message.includes('File size cannot exceed'))).toBeTruthy();
  });

  it('should validate MIME types', () => {
    const spoofedFile = new File([new Uint8Array([1, 2, 3, 4])], 'malicious.pdf', {
      type: 'application/javascript'
    });

    const errors = validateFileUpload(spoofedFile);
    expect(errors.some(e => e.message.includes('Invalid file content type'))).toBeTruthy();
  });
});

describe('sanitizeString', () => {
  it('should remove HTML tags', () => {
    const input = '<p>Test</p><script>alert("xss")</script>';
    expect(sanitizeString(input)).toBe('Testalert("xss")');
  });

  it('should remove SQL injection patterns', () => {
    const input = 'SELECT * FROM users; DROP TABLE users;';
    expect(sanitizeString(input)).toBe('* FROM users;  TABLE users;');
  });

  it('should escape special characters', () => {
    const input = '<>&"\'/';
    expect(sanitizeString(input)).toBe('&lt;&gt;&amp;&quot;&#x27;&#x2F;');
  });

  it('should handle empty, null, and undefined inputs', () => {
    expect(sanitizeString('')).toBe('');
    expect(sanitizeString(null as unknown as string)).toBe('');
    expect(sanitizeString(undefined as unknown as string)).toBe('');
  });

  it('should handle nested malicious patterns', () => {
    const input = '<script<script>>alert("xss")</script</script>>';
    expect(sanitizeString(input)).toBe('alert("xss")');
  });

  it('should preserve valid text content', () => {
    const input = 'Hello, World! This is a test 123.';
    expect(sanitizeString(input)).toBe(input);
  });

  it('should handle large strings efficiently', () => {
    const largeInput = faker.lorem.paragraphs(100);
    const start = performance.now();
    sanitizeString(largeInput);
    const end = performance.now();
    expect(end - start).toBeLessThan(100); // Should process within 100ms
  });
});