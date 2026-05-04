const MongoRecommendationEngine = require('../services/MongoRecommendationEngine');

describe('MongoRecommendationEngine core ranking logic', () => {
  let engine;

  beforeEach(() => {
    engine = new MongoRecommendationEngine();
  });

  test('search mode prioritizes exact match globally even when outside country', () => {
    const sorted = engine.sortUberBoltStyle([
      {
        id: 'same-country-non-exact',
        hasProfileImage: true,
        exactSearchMatch: false,
        sameCountry: true,
        searchIntentScore: 95,
        distance: 4,
        recommendationScore: 88
      },
      {
        id: 'exact-out-country',
        hasProfileImage: true,
        exactSearchMatch: true,
        sameCountry: false,
        searchIntentScore: 70,
        distance: 400,
        recommendationScore: 60
      }
    ], 'search');

    expect(sorted[0].id).toBe('exact-out-country');
  });

  test('search mode prioritizes same-country candidates when exact match tie does not apply', () => {
    const sorted = engine.sortUberBoltStyle([
      {
        id: 'out-country-high-intent',
        hasProfileImage: true,
        exactSearchMatch: false,
        sameCountry: false,
        searchIntentScore: 98,
        distance: 100,
        recommendationScore: 92
      },
      {
        id: 'same-country-lower-intent',
        hasProfileImage: true,
        exactSearchMatch: false,
        sameCountry: true,
        searchIntentScore: 75,
        distance: 12,
        recommendationScore: 84
      }
    ], 'search');

    expect(sorted[0].id).toBe('same-country-lower-intent');
  });

  test('dynamic trust floor relaxes when local supply is low', () => {
    const profiles = [
      { id: 'p1', trustScore: 20 },
      { id: 'p2', trustScore: 85 },
      { id: 'p3', trustScore: 30 },
      { id: 'p4', trustScore: 70 },
      { id: 'p5', trustScore: 25 },
      { id: 'p6', trustScore: 60 }
    ];

    const trustPolicy = engine.applyDynamicTrustFloor(profiles, {
      requestedFloor: 60,
      topWindowSize: 6,
      isSearchQuery: false
    });

    expect(trustPolicy.relaxed).toBe(true);
    expect(trustPolicy.appliedFloor).toBeLessThan(60);
    expect(trustPolicy.profiles[0].id).toBe('p2');
  });

  test('deriveRankingReasons returns transparent reason chips', () => {
    const reasons = engine.deriveRankingReasons(
      {
        sameCountry: true,
        distance: 1.2,
        isOnline: true,
        verificationTier: 2,
        trustScore: 90,
        scoreBreakdown: { engagement: 82 }
      },
      {
        countryFallbackApplied: false,
        trustPolicy: { relaxed: false, requestedFloor: 60 }
      }
    );

    const keys = reasons.map((reason) => reason.key);
    expect(keys).toContain('country_match');
    expect(keys).toContain('very_close');
    expect(keys).toContain('online_now');
    expect(keys).toContain('verified');
  });
});
