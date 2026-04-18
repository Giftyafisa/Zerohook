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
 * - Providers see: providers by default (+ dedicated client discovery surface)
 * - Sugar accounts see: verified young providers of opposite sex
 * - Sugar profiles: hidden by default, visible only to paid viewers
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

// Role-pair matrix for direct user interactions.
// Key = initiator account type, value = list of allowed target account types.
const INTERACTION_TARGET_MATRIX = Object.freeze({
  chat: Object.freeze({
    [ACCOUNT_TYPES.CLIENT]: [
      ACCOUNT_TYPES.PROVIDER,
      ACCOUNT_TYPES.SUGAR_DADDY,
      ACCOUNT_TYPES.SUGAR_MOMMY
    ],
    [ACCOUNT_TYPES.PROVIDER]: [
      ACCOUNT_TYPES.CLIENT,
      ACCOUNT_TYPES.PROVIDER,
      ACCOUNT_TYPES.SUGAR_DADDY,
      ACCOUNT_TYPES.SUGAR_MOMMY
    ],
    [ACCOUNT_TYPES.SUGAR_DADDY]: [ACCOUNT_TYPES.PROVIDER, ACCOUNT_TYPES.CLIENT],
    [ACCOUNT_TYPES.SUGAR_MOMMY]: [ACCOUNT_TYPES.PROVIDER, ACCOUNT_TYPES.CLIENT]
  }),
  booking: Object.freeze({
    [ACCOUNT_TYPES.CLIENT]: [
      ACCOUNT_TYPES.PROVIDER,
      ACCOUNT_TYPES.SUGAR_DADDY,
      ACCOUNT_TYPES.SUGAR_MOMMY
    ],
    [ACCOUNT_TYPES.SUGAR_DADDY]: [ACCOUNT_TYPES.PROVIDER],
    [ACCOUNT_TYPES.SUGAR_MOMMY]: [ACCOUNT_TYPES.PROVIDER]
  })
});

const ACCOUNT_TYPE_FIELD_PATHS = [
  'accountType',
  'account_type',
  'profile_data.accountType',
  'profile_data.account_type',
  'profileData.accountType',
  'profileData.account_type'
]

const PROFILE_VISIBILITY_FIELD_PATHS = [
  'profileVisibility',
  'profile_visibility',
  'profile_data.profileVisibility',
  'profile_data.profile_visibility',
  'profileData.profileVisibility',
  'profileData.profile_visibility'
]

const SUGAR_VISIBILITY_BOOLEAN_FIELD_PATHS = [
  'sugarSettings.visibleToProviders',
  'profile_data.sugarSettings.visibleToProviders',
  'profileData.sugarSettings.visibleToProviders'
]

const SUGAR_VISIBILITY_LEGACY_FIELD_PATHS = [
  'sugarVisibility',
  'profile_data.sugarVisibility',
  'profileData.sugarVisibility'
]

const GENDER_FIELD_PATHS = [
  'gender',
  'profile_data.gender',
  'profileData.gender'
]

const normalizeAccountTypeValue = (value) => {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const normalizeInteractionType = (interactionType) => {
  if (typeof interactionType !== 'string') return null;
  const normalized = interactionType.trim().toLowerCase();
  return normalized || null;
};

const resolveAccountTypeInput = (input) => {
  if (typeof input === 'string') {
    return normalizeAccountTypeValue(input);
  }

  return getAccountType(input);
};

const buildAnyFieldQuery = (fields, value) => ({
  $or: fields.map((field) => ({ [field]: value }))
});

const buildAnyFieldRegexQuery = (fields, regex) => ({
  $or: fields.map((field) => ({ [field]: regex }))
});

const buildAnyFieldInQuery = (fields, values) => ({
  $or: fields.map((field) => ({ [field]: { $in: values } }))
});

const buildAllFieldsNinQuery = (fields, values) => ({
  $and: fields.map((field) => ({ [field]: { $nin: values } }))
});

const buildPublicVisibilityFilter = () => ({
  $or: PROFILE_VISIBILITY_FIELD_PATHS.flatMap((field) => ([
    { [field]: 'public' },
    { [field]: { $exists: false } },
    { [field]: null }
  ]))
});

const buildAccountTypeQuery = (accountType) => {
  const normalizedType = normalizeAccountTypeValue(accountType) || ACCOUNT_TYPES.PROVIDER;

  return buildAnyFieldQuery(ACCOUNT_TYPE_FIELD_PATHS, normalizedType);
};

const buildAccountTypeInQuery = (accountTypes = []) => {
  const normalizedTypes = Array.from(new Set(
    (Array.isArray(accountTypes) ? accountTypes : [accountTypes])
      .map(normalizeAccountTypeValue)
      .filter(Boolean)
  ));

  if (normalizedTypes.length === 0) {
    return buildAccountTypeQuery(ACCOUNT_TYPES.PROVIDER);
  }

  return buildAnyFieldInQuery(ACCOUNT_TYPE_FIELD_PATHS, normalizedTypes);
};

const buildSugarVisibleToProvidersFilter = () => ({
  $or: [
    ...SUGAR_VISIBILITY_BOOLEAN_FIELD_PATHS.map((field) => ({ [field]: true })),
    ...SUGAR_VISIBILITY_LEGACY_FIELD_PATHS.map((field) => ({ [field]: 'visible' }))
  ]
});

const isSugarProfileVisibleToProviders = (user) => {
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
 * Handles various data structures (profile_data, etc.)
 */
const getAccountType = (user) => {
  if (!user) return null;

  const candidateValues = [
    user.profile_data?.accountType,
    user.profile_data?.account_type,
    user.profileData?.accountType,
    user.profileData?.account_type,
    user.accountType,
    user.account_type
  ];

  for (const candidateValue of candidateValues) {
    const normalized = normalizeAccountTypeValue(candidateValue);
    if (normalized) {
      return normalized;
    }
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
 * - Providers → see providers on default feed
 * - Sugar Daddy → see verified female providers
 * - Sugar Mommy → see verified male providers
 */
const getVisibleAccountTypes = (user) => {
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
 * Build MongoDB query filter for account type filtering
 * 
 * @param {Object} viewer - The user viewing profiles
 * @param {Object} options - Additional options
 * @returns {Object} MongoDB query filter object
 */
const buildAccountTypeFilter = (viewer, options = {}) => {
  const viewerType = resolveAccountTypeInput(viewer);
  const discoverySurface = String(options.discoverySurface || '').trim().toLowerCase();
  
  switch (viewerType) {
    case ACCOUNT_TYPES.CLIENT:
      // Clients see only providers
      return buildAccountTypeQuery(ACCOUNT_TYPES.PROVIDER);
      
    case ACCOUNT_TYPES.PROVIDER:
      // Providers see providers by default; clients are on explicit discovery surface.
      if (discoverySurface === 'clients') {
        return buildAccountTypeQuery(ACCOUNT_TYPES.CLIENT);
      }
      return buildAccountTypeQuery(ACCOUNT_TYPES.PROVIDER);
      
    case ACCOUNT_TYPES.SUGAR_DADDY:
      // Sugar daddy sees verified female providers
      return {
        $and: [
          buildAccountTypeQuery(ACCOUNT_TYPES.PROVIDER),
          { verification_tier: { $gte: 2 } },
          buildAnyFieldRegexQuery(GENDER_FIELD_PATHS, /^female$/i)
        ]
      };
      
    case ACCOUNT_TYPES.SUGAR_MOMMY:
      // Sugar mommy sees verified male providers
      return {
        $and: [
          buildAccountTypeQuery(ACCOUNT_TYPES.PROVIDER),
          { verification_tier: { $gte: 2 } },
          buildAnyFieldRegexQuery(GENDER_FIELD_PATHS, /^male$/i)
        ]
      };
      
    default:
      // Unauthenticated or unknown - show providers only
      return buildAccountTypeQuery(ACCOUNT_TYPES.PROVIDER);
  }
};

/**
 * Build MongoDB query filter for sugar profile visibility
 * 
 * @param {Object} viewer - The user viewing profiles (must be eligible client/provider)
 * @param {boolean} hasSugarAccess - Whether viewer has paid for sugar access
 * @returns {Object} MongoDB query filter object
 */
const buildSugarVisibilityFilter = (viewer, hasSugarAccess = false) => {
  const viewerType = resolveAccountTypeInput(viewer);
  const isEligibleSugarViewer = viewerType === ACCOUNT_TYPES.PROVIDER || viewerType === ACCOUNT_TYPES.CLIENT;
  
  // Only eligible client/provider accounts can see sugar profiles.
  if (!isEligibleSugarViewer) {
    return buildAllFieldsNinQuery(ACCOUNT_TYPE_FIELD_PATHS, SUGAR_TYPES);
  }
  
  // Eligible viewer without sugar access - exclude sugar profiles
  if (!hasSugarAccess) {
    return buildAllFieldsNinQuery(ACCOUNT_TYPE_FIELD_PATHS, SUGAR_TYPES);
  }
  
  // Eligible viewer with sugar access - include only explicitly visible sugar profiles.
  const sugarVisibilityQuery = buildSugarVisibleToProvidersFilter();

  return {
    $and: [
      buildAccountTypeInQuery(SUGAR_TYPES),
      sugarVisibilityQuery
    ]
  };
};

/**
 * @deprecated Use buildAccountTypeFilter instead. These generate PostgreSQL SQL.
 */
const buildAccountTypeWhereClause = (viewer, options = {}) => {
  console.warn('DEPRECATED: buildAccountTypeWhereClause generates PostgreSQL SQL. Use buildAccountTypeFilter for MongoDB.');
  return { clause: '', params: [] };
};

/**
 * @deprecated Use buildSugarVisibilityFilter instead. These generate PostgreSQL SQL.
 */
const buildSugarVisibilityClause = (viewer, hasSugarAccess = false) => {
  console.warn('DEPRECATED: buildSugarVisibilityClause generates PostgreSQL SQL. Use buildSugarVisibilityFilter for MongoDB.');
  return { clause: '', params: [] };
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
 * By default, sugar accounts prefer young providers (18-25)
 */
const getSugarAgePreference = (user) => {
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

/**
 * Validate account type string
 */
const isValidAccountType = (accountType) => {
  return ALL_ACCOUNT_TYPES.includes(accountType);
};

/**
 * Get allowed target account types for a given interaction and initiator type.
 *
 * @param {string} interactionType - e.g. "chat", "booking"
 * @param {Object|string} initiator - user object or account type string
 * @returns {Array<string>} allowed target account types
 */
const getAllowedInteractionTargets = (interactionType, initiator) => {
  const normalizedInteraction = normalizeInteractionType(interactionType);
  const initiatorType = resolveAccountTypeInput(initiator);

  if (!normalizedInteraction || !initiatorType) {
    return [];
  }

  const interactionMap = INTERACTION_TARGET_MATRIX[normalizedInteraction] || {};
  return Array.isArray(interactionMap[initiatorType])
    ? interactionMap[initiatorType]
    : [];
};

/**
 * Check if a role pair is allowed for a specific interaction type.
 *
 * @param {string} interactionType - e.g. "chat", "booking"
 * @param {Object|string} initiator - user object or account type string
 * @param {Object|string} target - user object or account type string
 * @returns {boolean}
 */
const isRolePairAllowed = (interactionType, initiator, target) => {
  const targetType = resolveAccountTypeInput(target);
  if (!targetType) {
    return false;
  }

  const allowedTargets = getAllowedInteractionTargets(interactionType, initiator);
  return allowedTargets.includes(targetType);
};

module.exports = {
  ACCOUNT_TYPES,
  SUGAR_TYPES,
  ALL_ACCOUNT_TYPES,
  INTERACTION_TARGET_MATRIX,
  getAccountType,
  buildAccountTypeQuery,
  buildAccountTypeInQuery,
  buildPublicVisibilityFilter,
  buildSugarVisibleToProvidersFilter,
  isSugarProfileVisibleToProviders,
  isClient,
  isProvider,
  isSugarDaddy,
  isSugarMommy,
  isSugarAccount,
  isVVIP,
  getVisibleAccountTypes,
  buildAccountTypeWhereClause,
  buildSugarVisibilityClause,
  buildAccountTypeFilter,
  buildSugarVisibilityFilter,
  getAllowedInteractionTargets,
  isRolePairAllowed,
  getSugarGenderPreference,
  getSugarAgePreference,
  isValidAccountType
};
