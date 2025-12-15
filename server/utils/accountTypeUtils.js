/**
 * Account Type Utilities (Server-Side)
 * 
 * Centralized utility functions for account type checking on the backend.
 * 
 * ACCOUNT TYPES:
 * - client: General users (sex seekers) who browse and book providers
 * - provider: Service providers (sex workers) who offer services
 * - sugar_daddy: VVIP male members with privacy-focused accounts
 * - sugar_mommy: VVIP female members with privacy-focused accounts
 * 
 * ACCESS RULES:
 * - Clients see: providers only
 * - Providers see: clients only (+ sugar profiles with paid access)
 * - Sugar accounts see: verified young providers of opposite sex
 * - Sugar profiles: hidden by default, visible only to paid providers
 */

// Valid account types in the system
const ACCOUNT_TYPES = {
  CLIENT: 'client',
  PROVIDER: 'provider',
  SUGAR_DADDY: 'sugar_daddy',
  SUGAR_MOMMY: 'sugar_mommy'
};

// Sugar account types (VVIP members)
const SUGAR_TYPES = [ACCOUNT_TYPES.SUGAR_DADDY, ACCOUNT_TYPES.SUGAR_MOMMY];

// All valid account types
const ALL_ACCOUNT_TYPES = Object.values(ACCOUNT_TYPES);

/**
 * Get account type from user object
 * Handles various data structures (profile_data, etc.)
 */
const getAccountType = (user) => {
  if (!user) return null;
  
  // Check profile_data (common format)
  if (user.profile_data?.accountType) {
    return user.profile_data.accountType;
  }
  
  // Check direct accountType property
  if (user.accountType) {
    return user.accountType;
  }
  
  // Check account_type (snake_case from DB queries)
  if (user.account_type) {
    return user.account_type;
  }
  
  return null;
};

/**
 * Check if user is a client (sex seeker)
 */
const isClient = (user) => {
  return getAccountType(user) === ACCOUNT_TYPES.CLIENT;
};

/**
 * Check if user is a provider (sex worker)
 */
const isProvider = (user) => {
  return getAccountType(user) === ACCOUNT_TYPES.PROVIDER;
};

/**
 * Check if user is a sugar daddy
 */
const isSugarDaddy = (user) => {
  return getAccountType(user) === ACCOUNT_TYPES.SUGAR_DADDY;
};

/**
 * Check if user is a sugar mommy
 */
const isSugarMommy = (user) => {
  return getAccountType(user) === ACCOUNT_TYPES.SUGAR_MOMMY;
};

/**
 * Check if user is any sugar type (daddy or mommy)
 */
const isSugarAccount = (user) => {
  const accountType = getAccountType(user);
  return SUGAR_TYPES.includes(accountType);
};

/**
 * Check if user is a VVIP member (sugar account)
 */
const isVVIP = isSugarAccount;

/**
 * Get what account types a user can see in their feed
 * 
 * RULES:
 * - Clients → see only providers
 * - Providers → see only clients (sugar requires paid access)
 * - Sugar Daddy → see verified female providers
 * - Sugar Mommy → see verified male providers
 */
const getVisibleAccountTypes = (user) => {
  const accountType = getAccountType(user);
  
  switch (accountType) {
    case ACCOUNT_TYPES.CLIENT:
      return [ACCOUNT_TYPES.PROVIDER];
    case ACCOUNT_TYPES.PROVIDER:
      return [ACCOUNT_TYPES.CLIENT]; // Sugar access requires payment
    case ACCOUNT_TYPES.SUGAR_DADDY:
    case ACCOUNT_TYPES.SUGAR_MOMMY:
      return [ACCOUNT_TYPES.PROVIDER]; // Only see providers
    default:
      return [ACCOUNT_TYPES.PROVIDER]; // Default to showing providers
  }
};

/**
 * Build SQL WHERE clause for account type filtering
 * 
 * @param {Object} viewer - The user viewing profiles
 * @param {Object} options - Additional options
 * @returns {Object} { clause: string, params: array }
 */
const buildAccountTypeWhereClause = (viewer, options = {}) => {
  const viewerType = getAccountType(viewer);
  const params = [];
  let clause = '';
  
  switch (viewerType) {
    case ACCOUNT_TYPES.CLIENT:
      // Clients see only providers
      clause = `AND u.profile_data->>'accountType' = 'provider'`;
      break;
      
    case ACCOUNT_TYPES.PROVIDER:
      // Providers see only clients (sugar access handled separately)
      clause = `AND u.profile_data->>'accountType' = 'client'`;
      break;
      
    case ACCOUNT_TYPES.SUGAR_DADDY:
      // Sugar daddy sees verified female providers
      clause = `AND u.profile_data->>'accountType' = 'provider'
                AND u.verification_tier >= 2
                AND LOWER(u.profile_data->>'gender') = 'female'`;
      break;
      
    case ACCOUNT_TYPES.SUGAR_MOMMY:
      // Sugar mommy sees verified male providers
      clause = `AND u.profile_data->>'accountType' = 'provider'
                AND u.verification_tier >= 2
                AND LOWER(u.profile_data->>'gender') = 'male'`;
      break;
      
    default:
      // Unauthenticated or unknown - show providers only
      clause = `AND u.profile_data->>'accountType' = 'provider'`;
  }
  
  return { clause, params };
};

/**
 * Build SQL WHERE clause for sugar profile visibility
 * 
 * @param {Object} viewer - The user viewing profiles (must be provider)
 * @param {boolean} hasSugarAccess - Whether viewer has paid for sugar access
 * @returns {Object} { clause: string, params: array }
 */
const buildSugarVisibilityClause = (viewer, hasSugarAccess = false) => {
  const viewerType = getAccountType(viewer);
  
  // Only providers can see sugar profiles
  if (viewerType !== ACCOUNT_TYPES.PROVIDER) {
    return { clause: `AND u.profile_data->>'accountType' NOT IN ('sugar_daddy', 'sugar_mommy')`, params: [] };
  }
  
  // Provider without sugar access - exclude sugar profiles
  if (!hasSugarAccess) {
    return { clause: `AND u.profile_data->>'accountType' NOT IN ('sugar_daddy', 'sugar_mommy')`, params: [] };
  }
  
  // Provider with sugar access - include visible sugar profiles
  return { 
    clause: `AND (
      u.profile_data->>'accountType' IN ('sugar_daddy', 'sugar_mommy')
      AND (u.profile_data->>'sugarVisibility' = 'visible' OR u.profile_data->>'sugarVisibility' IS NULL)
    )`, 
    params: [] 
  };
};

/**
 * Get the gender preference for sugar accounts
 * Sugar Daddy → prefers female providers
 * Sugar Mommy → prefers male providers
 */
const getSugarGenderPreference = (user) => {
  const accountType = getAccountType(user);
  
  switch (accountType) {
    case ACCOUNT_TYPES.SUGAR_DADDY:
      return 'female';
    case ACCOUNT_TYPES.SUGAR_MOMMY:
      return 'male';
    default:
      return null;
  }
};

/**
 * Get age preference for sugar accounts
 * By default, sugar accounts prefer young providers (18-30)
 */
const getSugarAgePreference = (user) => {
  if (!isSugarAccount(user)) return null;
  
  // Check if user has custom age preference
  const customMin = user.profile_data?.preferredAgeMin;
  const customMax = user.profile_data?.preferredAgeMax;
  
  if (customMin || customMax) {
    return {
      min: customMin || 18,
      max: customMax || 30
    };
  }
  
  // Default preference for sugar accounts: young providers
  return {
    min: 18,
    max: 30
  };
};

/**
 * Validate account type string
 */
const isValidAccountType = (accountType) => {
  return ALL_ACCOUNT_TYPES.includes(accountType);
};

module.exports = {
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
  getVisibleAccountTypes,
  buildAccountTypeWhereClause,
  buildSugarVisibilityClause,
  getSugarGenderPreference,
  getSugarAgePreference,
  isValidAccountType
};
