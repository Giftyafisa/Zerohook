const {
  getAccountType,
  buildAccountTypeQuery,
  buildPublicVisibilityFilter,
} = require('../utils/accountTypeUtils');

describe('accountTypeUtils', () => {
  test('getAccountType resolves legacy account type shapes', () => {
    expect(getAccountType({ accountType: 'Provider' })).toBe('provider');
    expect(getAccountType({ account_type: 'client' })).toBe('client');
    expect(getAccountType({ profile_data: { accountType: 'sugar_daddy' } })).toBe('sugar_daddy');
    expect(getAccountType({ profile_data: { account_type: 'sugar_mommy' } })).toBe('sugar_mommy');
    expect(getAccountType({ profileData: { accountType: 'provider' } })).toBe('provider');
    expect(getAccountType({ profileData: { account_type: 'client' } })).toBe('client');
  });

  test('buildAccountTypeQuery matches legacy account type field paths', () => {
    const query = buildAccountTypeQuery('provider');

    expect(query).toHaveProperty('$or');
    expect(query.$or).toEqual(
      expect.arrayContaining([
        { accountType: 'provider' },
        { account_type: 'provider' },
        { 'profile_data.accountType': 'provider' },
        { 'profile_data.account_type': 'provider' },
        { 'profileData.accountType': 'provider' },
        { 'profileData.account_type': 'provider' }
      ])
    );
  });

  test('buildPublicVisibilityFilter allows public or missing profile visibility across legacy paths', () => {
    const query = buildPublicVisibilityFilter();

    expect(query).toHaveProperty('$or');
    expect(query.$or).toEqual(
      expect.arrayContaining([
        { profileVisibility: 'public' },
        { profileVisibility: { $exists: false } },
        { profileVisibility: null },
        { profile_visibility: 'public' },
        { profile_visibility: { $exists: false } },
        { profile_visibility: null }
      ])
    );
  });
});