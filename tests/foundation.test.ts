import { describe, expect, it } from 'vitest';

describe('foundation', () => {
  it('keeps the MVP product boundary explicit', () => {
    const laterPhaseFeatures = ['custom-domain', 'stripe', 'visitor-chat'];

    expect(laterPhaseFeatures).not.toContain('authentication');
  });
});
