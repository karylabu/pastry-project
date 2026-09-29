import { identifyDiscountIdType } from './discountIdOcr';

describe('discount ID text screening', () => {
  test('recognizes Senior Citizen markers', () => {
    expect(identifyDiscountIdType('OFFICE OF SENIOR CITIZENS AFFAIRS OSCA')).toBe('senior_citizen');
    expect(identifyDiscountIdType('Republic Act 9994')).toBe('senior_citizen');
  });

  test('recognizes PWD markers', () => {
    expect(identifyDiscountIdType('PERSON WITH DISABILITY PWD')).toBe('pwd');
    expect(identifyDiscountIdType('RA 10754')).toBe('pwd');
  });

  test('flags ambiguous or unrecognized text for manual review', () => {
    expect(identifyDiscountIdType('Senior Citizen PWD')).toBe('ambiguous');
    expect(identifyDiscountIdType('Republic of the Philippines')).toBeNull();
  });
});