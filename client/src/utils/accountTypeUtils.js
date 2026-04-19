/**
 * Account Type Utilities
 * 
 * Centralized utility functions for account type checking across the platform.
 * 
 * ACCOUNT TYPES:
 * - client: General users (sex seekers) who browse and book providers
 * - provider: Service providers (sex workers) who offer services
 * - sugar_daddy: VVIP male members with privacy-focused accounts
 * - sugar_mommy: VVIP female members with privacy-focused accounts
 * 
 * ACCESS RULES:
 * - Clients see: providers only (ProfileFeed/ProfileBrowse)
 * - Providers see: providers on default feed (+ explicit client discovery surface)
 * - Sugar accounts see: verified young providers of opposite sex
 * - Sugar profiles: hidden by default, visible only to paid viewers
 */

// Valid account types in the system
export const ACCOUNT_TYPES = {
  CLIENT: 'client',
  PROVIDER: 'provider',
  SUGAR_DADDY: 'sugar_daddy',
  SUGAR_MOMMY: 'sugar_mommy'
};

// Sugar account types (VVIP members)
export const SUGAR_TYPES = [ACCOUNT_TYPES.SUGAR_DADDY, ACCOUNT_TYPES.SUGAR_MOMMY];

// All valid account types
export const ALL_ACCOUNT_TYPES = Object.values(ACCOUNT_TYPES);

const normalizeAccountTypeValue = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

export const isSugarProfileVisibleToProviders = (user) => {
  if (!user) return false;

  const visibilityCandidates = [
    user.sugarSettings?.visibleToProviders,
    user.profile_data?.sugarSettings?.visibleToProviders,
    user.profileData?.sugarSettings?.visibleToProviders,
    user.sugarVisibility,
    user.profile_data?.sugarVisibility,
    user.profileData?.sugarVisibility
  ];

  for (const candidate of visibilityCandidates) {
    if (typeof candidate === 'boolean') return candidate;
    if (typeof candidate === 'string') {
      const normalized = candidate.trim().toLowerCase();
      if (normalized === 'visible') return true;
      if (normalized === 'hidden') return false;
    }
  }

  // Privacy-first default.
  return false;
};

/**
 * Get account type from user object
 * Handles various data structures (profile_data, profileData, etc.)
 */
export const getAccountType = (user) => {
  if (!user) return null;

  const candidateValues = [
    user.profile_data?.accountType,
    user.profile_data?.account_type,
    user.profileData?.accountType,
    user.profileData?.account_type,
    user.accountType,
    user.account_type
  ];

  for (const candidate of candidateValues) {
    const normalized = normalizeAccountTypeValue(candidate);
    if (normalized) {
      return normalized;
    }
  }
  
  return null;
};

/**
 * Check if user is a client (sex seeker)
 */
export const isClient = (user) => {
  return getAccountType(user) === ACCOUNT_TYPES.CLIENT;
};

/**
 * Check if user is a provider (sex worker)
 */
export const isProvider = (user) => {
  return getAccountType(user) === ACCOUNT_TYPES.PROVIDER;
};

/**
 * Check if user is a sugar daddy
 */
export const isSugarDaddy = (user) => {
  return getAccountType(user) === ACCOUNT_TYPES.SUGAR_DADDY;
};

/**
 * Check if user is a sugar mommy
 */
export const isSugarMommy = (user) => {
  return getAccountType(user) === ACCOUNT_TYPES.SUGAR_MOMMY;
};

/**
 * Check if user is any sugar type (daddy or mommy)
 */
export const isSugarAccount = (user) => {
  const accountType = getAccountType(user);
  return SUGAR_TYPES.includes(accountType);
};

/**
 * Check if user is a VVIP member (sugar account)
 */
export const isVVIP = isSugarAccount;

/**
 * Get the display name for an account type
 */
export const getAccountTypeDisplayName = (accountType) => {
  switch (accountType) {
    case ACCOUNT_TYPES.CLIENT:
      return 'Client';
    case ACCOUNT_TYPES.PROVIDER:
      return 'Service Provider';
    case ACCOUNT_TYPES.SUGAR_DADDY:
      return 'Sugar Daddy';
    case ACCOUNT_TYPES.SUGAR_MOMMY:
      return 'Sugar Mommy';
    default:
      return 'User';
  }
};

/**
 * Get the badge color for an account type
 */
export const getAccountTypeBadgeColor = (accountType) => {
  switch (accountType) {
    case ACCOUNT_TYPES.CLIENT:
      return '#4CAF50'; // Green
    case ACCOUNT_TYPES.PROVIDER:
      return '#FF6B6B'; // Pink/Red
    case ACCOUNT_TYPES.SUGAR_DADDY:
      return '#FFD700'; // Gold
    case ACCOUNT_TYPES.SUGAR_MOMMY:
      return '#FF69B4'; // Hot Pink
    default:
      return '#9E9E9E'; // Grey
  }
};

/**
 * Get what account types a user can see in their feed
 * 
 * RULES:
 * - Clients → see only providers
 * - Providers → see providers on default feed
 * - Sugar Daddy → see verified female providers
 * - Sugar Mommy → see verified male providers
 */
export const getVisibleAccountTypes = (user) => {
  const accountType = getAccountType(user);
  
  switch (accountType) {
    case ACCOUNT_TYPES.CLIENT:
      return [ACCOUNT_TYPES.PROVIDER];
    case ACCOUNT_TYPES.PROVIDER:
      return [ACCOUNT_TYPES.PROVIDER];
    case ACCOUNT_TYPES.SUGAR_DADDY:
    case ACCOUNT_TYPES.SUGAR_MOMMY:
      return [ACCOUNT_TYPES.PROVIDER]; // Only see providers
    default:
      return [ACCOUNT_TYPES.PROVIDER]; // Default to showing providers
  }
};

/**
 * Check if a viewer can see a target user's profile
 * 
 * @param {Object} viewer - The user viewing profiles
 * @param {Object} target - The profile being viewed
 * @param {Object} options - Additional options (hasSugarAccess, etc.)
 */
export const canViewProfile = (viewer, target, options = {}) => {
  const viewerType = getAccountType(viewer);
  const targetType = getAccountType(target);
  
  // Same user can always view their own profile
  if (viewer?.id === target?.id) return true;
  
  // Sugar profiles have special visibility rules
  if (SUGAR_TYPES.includes(targetType)) {
    // Only client/provider accounts with paid sugar access can see sugar profiles.
    const isEligibleSugarViewer = viewerType === ACCOUNT_TYPES.PROVIDER || viewerType === ACCOUNT_TYPES.CLIENT;
    if (!isEligibleSugarViewer) return false;
    if (!options.hasSugarAccess) return false;

    return isSugarProfileVisibleToProviders(target);
  }
  
  // Normal visibility rules
  const visibleTypes = getVisibleAccountTypes(viewer);
  return visibleTypes.includes(targetType);
};

/**
 * Filter profiles based on account type visibility rules
 * 
 * @param {Array} profiles - Array of profiles to filter
 * @param {Object} viewer - The user viewing profiles
 * @param {Object} options - Additional options (hasSugarAccess, etc.)
 */
export const filterProfilesByAccountType = (profiles, viewer, options = {}) => {
  if (!profiles || !Array.isArray(profiles)) return [];
  
  return profiles.filter(profile => canViewProfile(viewer, profile, options));
};

/**
 * Check if an eligible viewer has paid for sugar profile access
 * This should be verified on the backend, but this is a frontend helper
 */
export const hasSugarAccessPaid = (user) => {
  // Check various places where sugar access might be stored
  return (
    user?.hasSugarAccess === true ||
    user?.profile_data?.hasSugarAccess === true ||
    user?.profileData?.hasSugarAccess === true ||
    user?.sugar_access_paid === true ||
    user?.sugarAccessPaid === true
  );
};

/**
 * Get the gender preference for sugar accounts
 * Sugar Daddy → prefers female providers
 * Sugar Mommy → prefers male providers
 */
export const getSugarGenderPreference = (user) => {
  const accountType = getAccountType(user);
  
  switch (accountType) {
    case ACCOUNT_TYPES.SUGAR_DADDY:
      return 'female';
    case ACCOUNT_TYPES.SUGAR_MOMMY:
      return 'male';
    default:
      return null; // No specific preference
  }
};

/**
 * Get age preference for sugar accounts
 * By default, sugar accounts prefer young providers (18-25)
 */
export const getSugarAgePreference = (user) => {
  if (!isSugarAccount(user)) return null;
  
  // Check if user has custom age preference
  const customRange = user.profile_data?.sugarSettings?.preferredAgeRange ||
                      user.profileData?.sugarSettings?.preferredAgeRange;
  const customMin = customRange?.min || user.profile_data?.preferredAgeMin || user.profileData?.preferredAgeMin;
  const customMax = customRange?.max || user.profile_data?.preferredAgeMax || user.profileData?.preferredAgeMax;
  
  if (customMin || customMax) {
    return {
      min: customMin || 18,
      max: customMax || 25
    };
  }
  
  // Default preference for sugar accounts: young providers
  return {
    min: 18,
    max: 25
  };
};

const accountTypeUtils = {
  ACCOUNT_TYPES,
  SUGAR_TYPES,
  ALL_ACCOUNT_TYPES,
  getAccountType,
  isClient,
  isProvider,
  isSugarDaddy,
  isSugarMommy,
  isSugarAccount,
  isVVIP,
  getAccountTypeDisplayName,
  getAccountTypeBadgeColor,
  getVisibleAccountTypes,
  canViewProfile,
  filterProfilesByAccountType,
  hasSugarAccessPaid,
  isSugarProfileVisibleToProviders,
  getSugarGenderPreference,
  getSugarAgePreference
};

export default accountTypeUtils;
