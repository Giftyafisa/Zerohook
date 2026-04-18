const {
  getAccountType,
  buildAccountTypeQuery,
  buildAccountTypeInQuery,
  buildPublicVisibilityFilter,
  buildSugarVisibilityFilter,
  isSugarProfileVisibleToProviders,
  getAllowedInteractionTargets,
  isRolePairAllowed,
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

  test('buildAccountTypeInQuery matches all supported account type field paths', () => {
    const query = buildAccountTypeInQuery(['sugar_daddy', 'sugar_mommy']);

    expect(query).toHaveProperty('$or');
    expect(query.$or).toEqual(
      expect.arrayContaining([
        { accountType: { $in: ['sugar_daddy', 'sugar_mommy'] } },
        { account_type: { $in: ['sugar_daddy', 'sugar_mommy'] } },
        { 'profile_data.accountType': { $in: ['sugar_daddy', 'sugar_mommy'] } },
        { 'profile_data.account_type': { $in: ['sugar_daddy', 'sugar_mommy'] } },
        { 'profileData.accountType': { $in: ['sugar_daddy', 'sugar_mommy'] } },
        { 'profileData.account_type': { $in: ['sugar_daddy', 'sugar_mommy'] } }
      ])
    );
  });

  test('buildSugarVisibilityFilter requires explicit visibility when provider has sugar access', () => {
    const query = buildSugarVisibilityFilter('provider', true);

    expect(query).toHaveProperty('$and');
    const visibilityClause = query.$and[1];

    expect(visibilityClause.$or).toEqual(
      expect.arrayContaining([
        { 'profile_data.sugarSettings.visibleToProviders': true },
        { 'profileData.sugarSettings.visibleToProviders': true },
        { 'profile_data.sugarVisibility': 'visible' }
      ])
    );
    expect(visibilityClause.$or).not.toEqual(
      expect.arrayContaining([
        { 'profile_data.sugarSettings.visibleToProviders': { $exists: false } },
        { 'profile_data.sugarSettings.visibleToProviders': null }
      ])
    );
  });

  test('buildSugarVisibilityFilter allows client viewers when sugar access is active', () => {
    const query = buildSugarVisibilityFilter('client', true);

    expect(query).toHaveProperty('$and');
    expect(query.$and).toHaveLength(2);
  });

  test('isSugarProfileVisibleToProviders defaults to hidden when no visibility field exists', () => {
    expect(isSugarProfileVisibleToProviders({ profile_data: {} })).toBe(false);
    expect(isSugarProfileVisibleToProviders({ profile_data: { sugarSettings: { visibleToProviders: true } } })).toBe(true);
    expect(isSugarProfileVisibleToProviders({ profileData: { sugarVisibility: 'visible' } })).toBe(true);
    expect(isSugarProfileVisibleToProviders({ profileData: { sugarVisibility: 'hidden' } })).toBe(false);
  });

  test('getAllowedInteractionTargets returns expected chat matrix targets', () => {
    expect(getAllowedInteractionTargets('chat', 'client')).toEqual(
      expect.arrayContaining(['provider', 'sugar_daddy', 'sugar_mommy'])
    );
    expect(getAllowedInteractionTargets('chat', 'provider')).toEqual(
      expect.arrayContaining(['client', 'provider', 'sugar_daddy', 'sugar_mommy'])
    );
    expect(getAllowedInteractionTargets('chat', 'unknown_role')).toEqual([]);
  });

  test('isRolePairAllowed enforces chat and booking matrix pairs', () => {
    expect(isRolePairAllowed('chat', 'client', 'provider')).toBe(true);
    expect(isRolePairAllowed('chat', 'client', 'client')).toBe(false);
    expect(isRolePairAllowed('chat', 'sugar_daddy', 'provider')).toBe(true);
    expect(isRolePairAllowed('chat', 'sugar_mommy', 'client')).toBe(true);
    expect(isRolePairAllowed('chat', 'client', 'sugar_daddy')).toBe(true);

    expect(isRolePairAllowed('booking', 'client', 'provider')).toBe(true);
    expect(isRolePairAllowed('booking', 'provider', 'client')).toBe(false);
    expect(isRolePairAllowed('booking', 'sugar_daddy', 'provider')).toBe(true);
  });
});