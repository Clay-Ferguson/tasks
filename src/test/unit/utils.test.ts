import { describe, it } from 'mocha';
import * as assert from 'assert';
import { parseTimestamp } from '../../pure-utils';

describe('parseTimestamp', () => {
	describe('valid timestamp formats', () => {
		it('should parse date-only format [MM/DD/YYYY]', () => {
			const result = parseTimestamp('[09/30/2025]');
			assert.ok(result instanceof Date);
			assert.strictEqual(result!.getFullYear(), 2025);
			assert.strictEqual(result!.getMonth(), 8); // Month is 0-indexed
			assert.strictEqual(result!.getDate(), 30);
			assert.strictEqual(result!.getHours(), 12); // Should default to 12 PM
			assert.strictEqual(result!.getMinutes(), 0);
			assert.strictEqual(result!.getSeconds(), 0);
		});

		it('should parse full timestamp format [MM/DD/YYYY HH:MM:SS AM/PM]', () => {
			const result = parseTimestamp('[09/30/2025 02:30:45 PM]');
			assert.ok(result instanceof Date);
			assert.strictEqual(result!.getFullYear(), 2025);
			assert.strictEqual(result!.getMonth(), 8); // Month is 0-indexed
			assert.strictEqual(result!.getDate(), 30);
			assert.strictEqual(result!.getHours(), 14); // 2 PM = 14:00 in 24-hour format
			assert.strictEqual(result!.getMinutes(), 30);
			assert.strictEqual(result!.getSeconds(), 45);
		});

		it('should parse AM time correctly', () => {
			const result = parseTimestamp('[01/15/2024 08:15:30 AM]');
			assert.ok(result instanceof Date);
			assert.strictEqual(result!.getHours(), 8);
			assert.strictEqual(result!.getMinutes(), 15);
			assert.strictEqual(result!.getSeconds(), 30);
		});

		it('should parse 12 AM as midnight', () => {
			const result = parseTimestamp('[01/15/2024 12:00:00 AM]');
			assert.ok(result instanceof Date);
			assert.strictEqual(result!.getHours(), 0); // 12 AM = 0:00 in 24-hour format
		});

		it('should parse 12 PM as noon', () => {
			const result = parseTimestamp('[01/15/2024 12:00:00 PM]');
			assert.ok(result instanceof Date);
			assert.strictEqual(result!.getHours(), 12); // 12 PM = 12:00 in 24-hour format
		});
	});

	describe('invalid timestamp formats', () => {
		it('should return null for malformed brackets', () => {
			const result = parseTimestamp('09/30/2025]');
			assert.strictEqual(result, null);
		});

		it('should return null for missing brackets entirely', () => {
			const result = parseTimestamp('09/30/2025');
			assert.strictEqual(result, null);
		});

		it('should return null for invalid date format', () => {
			const result = parseTimestamp('[30/09/2025]'); // Wrong order DD/MM/YYYY
			assert.strictEqual(result, null);
		});

		it('should return null for incomplete date', () => {
			const result = parseTimestamp('[09/30]');
			assert.strictEqual(result, null);
		});

		it('should return null for invalid year format', () => {
			const result = parseTimestamp('[09/30/25]'); // Two-digit year
			assert.strictEqual(result, null);
		});

		it('should return null for invalid month', () => {
			const result = parseTimestamp('[13/30/2025]'); // Month 13 doesn't exist
			assert.strictEqual(result, null);
		});

		it('should return null for invalid day', () => {
			const result = parseTimestamp('[02/31/2025]'); // February 31st doesn't exist
			assert.strictEqual(result, null);
		});

		it('should return null for malformed time', () => {
			const result = parseTimestamp('[09/30/2025 25:00:00 PM]'); // 25 hours doesn't exist
			assert.strictEqual(result, null);
		});

		it('should return null for empty string', () => {
			const result = parseTimestamp('');
			assert.strictEqual(result, null);
		});
	});

	describe('edge cases', () => {
		it('should handle leap year February 29th', () => {
			const result = parseTimestamp('[02/29/2024]'); // 2024 is a leap year
			assert.ok(result instanceof Date);
			assert.strictEqual(result!.getMonth(), 1); // February (0-indexed)
			assert.strictEqual(result!.getDate(), 29);
		});

		it('should reject February 29th in non-leap year', () => {
			const result = parseTimestamp('[02/29/2023]'); // 2023 is not a leap year
			assert.strictEqual(result, null);
		});

		it('should handle end of year date', () => {
			const result = parseTimestamp('[12/31/2025]');
			assert.ok(result instanceof Date);
			assert.strictEqual(result!.getMonth(), 11); // December (0-indexed)
			assert.strictEqual(result!.getDate(), 31);
		});

		it('should handle single-digit months and days with leading zeros', () => {
			const result = parseTimestamp('[01/05/2025]');
			assert.ok(result instanceof Date);
			assert.strictEqual(result!.getMonth(), 0); // January (0-indexed)
			assert.strictEqual(result!.getDate(), 5);
		});
	});
});