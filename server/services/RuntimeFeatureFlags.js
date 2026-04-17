const parseEnvBoolean = (value, fallback) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const DEFAULT_RUNTIME_FLAGS = {
  recommendationV2Enabled: {
    enabled: true,
    description: 'Enable Uber/Bolt recommendation engine for recommendation sort mode.'
  },
  recommendationRollbackEnabled: {
    enabled: false,
    description: 'Emergency switch: force fallback simple sorting for recommendation sort mode.'
  },
  providerClientSurfaceDefaultEnabled: {
    enabled: true,
    description: 'Provider default discovery surface is clients on the same feed page.'
  },
  dynamicTrustFloorEnabled: {
    enabled: true,
    description: 'Enable dynamic trust-floor balancing in recommendation ranking.'
  },
  rankingReasonsEnabled: {
    enabled: true,
    description: 'Attach ranking reason metadata for profile explainability.'
  },
  apiContractEnforcementEnabled: {
    enabled: true,
    description: 'Normalize API responses to the { success, data, message } contract.'
  },
  apiContractStrictModeEnabled: {
    enabled: true,
    description: 'Emit warnings when payloads need normalization to satisfy contract.'
  }
};

class RuntimeFeatureFlags {
  constructor(overrides = {}) {
    this.flags = new Map();
    this.updatedAt = new Date().toISOString();
    this.loadDefaults(overrides);
  }

  loadDefaults(overrides = {}) {
    const envOverrides = {
      recommendationV2Enabled: parseEnvBoolean(process.env.FEATURE_RECOMMENDATION_V2_ENABLED, undefined),
      recommendationRollbackEnabled: parseEnvBoolean(process.env.FEATURE_RECOMMENDATION_ROLLBACK_ENABLED, undefined),
      providerClientSurfaceDefaultEnabled: parseEnvBoolean(process.env.FEATURE_PROVIDER_CLIENT_SURFACE_DEFAULT_ENABLED, undefined),
      dynamicTrustFloorEnabled: parseEnvBoolean(process.env.FEATURE_DYNAMIC_TRUST_FLOOR_ENABLED, undefined),
      rankingReasonsEnabled: parseEnvBoolean(process.env.FEATURE_RANKING_REASONS_ENABLED, undefined),
      apiContractEnforcementEnabled: parseEnvBoolean(process.env.FEATURE_API_CONTRACT_ENFORCEMENT_ENABLED, undefined),
      apiContractStrictModeEnabled: parseEnvBoolean(process.env.FEATURE_API_CONTRACT_STRICT_MODE_ENABLED, undefined)
    };

    for (const [name, config] of Object.entries(DEFAULT_RUNTIME_FLAGS)) {
      const envValue = envOverrides[name];
      const overrideValue = overrides[name];
      const enabled = typeof overrideValue === 'boolean'
        ? overrideValue
        : (typeof envValue === 'boolean' ? envValue : config.enabled);

      this.flags.set(name, {
        enabled,
        description: config.description,
        updatedAt: this.updatedAt,
        source: typeof overrideValue === 'boolean'
          ? 'constructor'
          : (typeof envValue === 'boolean' ? 'env' : 'default')
      });
    }
  }

  has(name) {
    return this.flags.has(name);
  }

  get(name, fallback = false) {
    if (!this.flags.has(name)) return fallback;
    return this.flags.get(name).enabled;
  }

  isEnabled(name, fallback = false) {
    return this.get(name, fallback);
  }

  set(name, enabled, metadata = {}) {
    if (!this.flags.has(name)) {
      throw new Error(`Unknown feature flag: ${name}`);
    }
    if (typeof enabled !== 'boolean') {
      throw new Error(`Feature flag "${name}" expects a boolean value`);
    }

    const current = this.flags.get(name);
    const next = {
      ...current,
      enabled,
      updatedAt: new Date().toISOString(),
      source: metadata.source || 'runtime'
    };

    this.flags.set(name, next);
    this.updatedAt = next.updatedAt;
    return this.snapshotFlag(name);
  }

  setMany(flagUpdates = {}, metadata = {}) {
    const updated = [];
    for (const [name, enabled] of Object.entries(flagUpdates)) {
      updated.push(this.set(name, !!enabled, metadata));
    }
    return updated;
  }

  applyRecommendationRollback(enabled = true) {
    const safeEnabled = !!enabled;
    this.set('recommendationRollbackEnabled', safeEnabled, { source: 'rollback' });
    this.set('recommendationV2Enabled', !safeEnabled, { source: 'rollback' });

    return {
      rollbackEnabled: this.get('recommendationRollbackEnabled'),
      recommendationV2Enabled: this.get('recommendationV2Enabled')
    };
  }

  snapshot() {
    const flags = {};
    for (const [name, config] of this.flags.entries()) {
      flags[name] = {
        enabled: config.enabled,
        description: config.description,
        updatedAt: config.updatedAt,
        source: config.source
      };
    }
    return {
      updatedAt: this.updatedAt,
      flags
    };
  }

  snapshotFlag(name) {
    if (!this.flags.has(name)) return null;
    const flag = this.flags.get(name);
    return {
      name,
      enabled: flag.enabled,
      description: flag.description,
      updatedAt: flag.updatedAt,
      source: flag.source
    };
  }
}

module.exports = RuntimeFeatureFlags;
module.exports.DEFAULT_RUNTIME_FLAGS = DEFAULT_RUNTIME_FLAGS;