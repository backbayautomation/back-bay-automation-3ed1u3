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
      expect(validateEmail(email)).toHaveLength(0);
    });
  });

  it('should validate international email formats', () => {
    const internationalEmails = [
      'user@domain.co.uk',
      'user@domain.com.au',
      'user@subdomain.domain.org'
    ];

    internationalEmails.forEach(email => {
      expect(validateEmail(email)).toHaveLength(0);
    });
  });

  it('should reject invalid email formats', () => {
    const invalidEmails = [
      '',
      'invalid',
      '@domain.com',
      'user@',
      'user@domain',
      'user@.com',
      'user@domain.',
      'user name@domain.com'
    ];

    invalidEmails.forEach(email => {
      expect(validateEmail(email)).toHaveLength(1);
      expect(validateEmail(email)[0].field).toBe('email');
    });
  });

  it('should detect SQL injection patterns in emails', () => {
    const maliciousEmails = [
      "user'--@domain.com",
      'user;DROP TABLE users;--@domain.com',
      "user' OR '1'='1@domain.com"
    ];

    maliciousEmails.forEach(email => {
      expect(validateEmail(email)).toHaveLength(1);
    });
  });

  it('should handle edge cases', () => {
    expect(validateEmail(' ')).toHaveLength(1);
    expect(validateEmail('a'.repeat(256) + '@domain.com')).toHaveLength(1);
    expect(validateEmail(null as unknown as string)).toHaveLength(1);
    expect(validateEmail(undefined as unknown as string)).toHaveLength(1);
  });
});

describe('validatePassword', () => {
  it('should validate strong passwords', () => {
    const strongPasswords = [
      'Test123!@#',
      'SecureP@ssw0rd',
      'Complex1ty!',
      faker.internet.password({ length: 12, pattern: /[A-Za-z0-9!@#$%^&*]/ })
    ];

    strongPasswords.forEach(password => {
      expect(validatePassword(password)).toHaveLength(0);
    });
  });

  it('should enforce minimum length requirement', () => {
    const shortPassword = 'Abc123!';
    const errors = validatePassword(shortPassword);
    
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH.toString());
  });

  it('should enforce maximum length requirement', () => {
    const longPassword = 'A1!'.repeat(50);
    const errors = validatePassword(longPassword);
    
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH.toString());
  });

  it('should require all character types', () => {
    const incompletePasswords = [
      'onlylowercase',
      'ONLYUPPERCASE',
      'NoNumbers!',
      'no2special',
      '12345678'
    ];

    incompletePasswords.forEach(password => {
      const errors = validatePassword(password);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('should detect common password patterns', () => {
    const commonPasswords = [
      'Password123!',
      'Qwerty123!',
      '12345678Ab!',
      'Admin123!'
    ];

    commonPasswords.forEach(password => {
      const errors = validatePassword(password);
      expect(errors.some(e => e.message.includes('common pattern'))).toBeTruthy();
    });
  });

  it('should handle edge cases', () => {
    expect(validatePassword('')).toHaveLength(1);
    expect(validatePassword(' '.repeat(10))).toHaveLength(4);
    expect(validatePassword(null as unknown as string)).toHaveLength(1);
    expect(validatePassword(undefined as unknown as string)).toHaveLength(1);
  });
});

describe('validateFileUpload', () => {
  let validFile: File;
  let invalidFile: File;

  beforeEach(() => {
    const validContent = new Uint8Array([1, 2, 3, 4]);
    validFile = new File([validContent], 'test.pdf', {
      type: 'application/pdf',
      lastModified: Date.now()
    });

    const invalidContent = new Uint8Array([1, 2, 3, 4]);
    invalidFile = new File([invalidContent], 'test.exe', {
      type: 'application/x-msdownload',
      lastModified: Date.now()
    });
  });

  it('should validate allowed file types', () => {
    const errors = validateFileUpload(validFile);
    expect(errors).toHaveLength(0);
  });

  it('should reject files exceeding size limit', () => {
    Object.defineProperty(validFile, 'size', {
      value: VALIDATION_CONSTANTS.MAX_FILE_SIZE + 1000
    });

    const errors = validateFileUpload(validFile);
    expect(errors.some(e => e.message.includes('size'))).toBeTruthy();
  });

  it('should reject disallowed file types', () => {
    const errors = validateFileUpload(invalidFile);
    expect(errors.some(e => e.message.includes('type'))).toBeTruthy();
  });

  it('should validate file MIME types', () => {
    const maliciousFile = new File([], 'malicious.pdf', {
      type: 'application/javascript'
    });

    const errors = validateFileUpload(maliciousFile);
    expect(errors.some(e => e.message.includes('content type'))).toBeTruthy();
  });

  it('should handle edge cases', () => {
    const emptyFile = new File([], '');
    expect(validateFileUpload(emptyFile)).toHaveLength(2);
    expect(validateFileUpload(null as unknown as File)).toHaveLength(1);
    expect(validateFileUpload(undefined as unknown as File)).toHaveLength(1);
  });
});

describe('sanitizeString', () => {
  it('should remove HTML tags', () => {
    const input = '<p>Test</p><script>alert("xss")</script>';
    expect(sanitizeString(input)).toBe('Testalert("xss")');
  });

  it('should remove SQL injection patterns', () => {
    const sqlPatterns = [
      "DROP TABLE users;",
      "SELECT * FROM passwords;",
      "1'; DELETE FROM customers; --"
    ];

    sqlPatterns.forEach(pattern => {
      const sanitized = sanitizeString(pattern);
      expect(sanitized).not.toContain('DROP');
      expect(sanitized).not.toContain('SELECT');
      expect(sanitized).not.toContain('DELETE');
    });
  });

  it('should escape special characters', () => {
    const input = '<>&"\'/';
    const expected = '&lt;&gt;&amp;&quot;&#x27;&#x2F;';
    expect(sanitizeString(input)).toBe(expected);
  });

  it('should handle XSS attack patterns', () => {
    const xssPatterns = [
      '<img src="x" onerror="alert(1)">',
      '<script>document.cookie</script>',
      '<style>body{background:url("javascript:alert(1)")}</style>'
    ];

    xssPatterns.forEach(pattern => {
      const sanitized = sanitizeString(pattern);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).not.toContain('javascript:');
    });
  });

  it('should handle edge cases', () => {
    expect(sanitizeString('')).toBe('');
    expect(sanitizeString(' ')).toBe(' ');
    expect(sanitizeString(null as unknown as string)).toBe('');
    expect(sanitizeString(undefined as unknown as string)).toBe('');
    expect(sanitizeString('a'.repeat(10000))).toHaveLength(10000);
  });

  it('should preserve valid content', () => {
    const validContent = [
      'Regular text',
      'Numbers 123',
      'Symbols !@#$%^&*()',
      'Unicode characters ñáéíóú'
    ];

    validContent.forEach(content => {
      expect(sanitizeString(content)).toBe(content);
    });
  });
});