import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockClarity = {
  tx: {
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  },
  block: {
    height: 100,
  },
  contracts: {
    insuranceVerification: {
      insurancePolicies: new Map(),
      authorizedVerifiers: new Map(),
      
      // Initialize contract owner as authorized verifier
      init: function() {
        this.authorizedVerifiers.set(mockClarity.tx.sender, { authorized: true });
      },
      
      addAuthorizedVerifier: function(verifier) {
        if (mockClarity.tx.sender !== 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM') {
          return { err: 100 }; // ERR-NOT-AUTHORIZED
        }
        
        this.authorizedVerifiers.set(verifier, { authorized: true });
        return { ok: true };
      },
      
      removeAuthorizedVerifier: function(verifier) {
        if (mockClarity.tx.sender !== 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM') {
          return { err: 100 }; // ERR-NOT-AUTHORIZED
        }
        
        this.authorizedVerifiers.set(verifier, { authorized: false });
        return { ok: true };
      },
      
      isAuthorizedVerifier: function(verifier) {
        const verifierData = this.authorizedVerifiers.get(verifier);
        return verifierData ? verifierData.authorized : false;
      },
      
      registerInsurancePolicy: function(propertyId, policyNumber, provider, coverageAmount, expirationDate) {
        this.insurancePolicies.set(propertyId, {
          policyNumber,
          provider,
          coverageAmount,
          expirationDate,
          verified: false,
          adequateCoverage: false
        });
        
        return { ok: true };
      },
      
      verifyInsurancePolicy: function(propertyId, riskScore, propertyValue) {
        const caller = mockClarity.tx.sender;
        
        if (!this.isAuthorizedVerifier(caller)) {
          return { err: 100 }; // ERR-NOT-AUTHORIZED
        }
        
        const policy = this.insurancePolicies.get(propertyId);
        if (!policy) {
          return { err: 101 }; // ERR-POLICY-NOT-FOUND
        }
        
        if (mockClarity.block.height >= policy.expirationDate) {
          return { err: 102 }; // ERR-EXPIRED-POLICY
        }
        
        const requiredCoverage = this.calculateRequiredCoverage(riskScore, propertyValue);
        const hasAdequateCoverage = policy.coverageAmount >= requiredCoverage;
        
        this.insurancePolicies.set(propertyId, {
          ...policy,
          verified: true,
          adequateCoverage: hasAdequateCoverage
        });
        
        return { ok: hasAdequateCoverage };
      },
      
      calculateRequiredCoverage: function(riskScore, propertyValue) {
        const riskFactor = (riskScore * 100) / 10000;
        const minCoverage = propertyValue / 2;
        return minCoverage + (propertyValue * riskFactor);
      },
      
      getInsurancePolicy: function(propertyId) {
        return this.insurancePolicies.get(propertyId);
      },
      
      hasAdequateCoverage: function(propertyId) {
        const policy = this.insurancePolicies.get(propertyId);
        return policy ? policy.adequateCoverage : false;
      },
      
      isInsuranceVerified: function(propertyId) {
        const policy = this.insurancePolicies.get(propertyId);
        return policy ? policy.verified : false;
      }
    }
  }
};

// Tests for Insurance Verification Contract
describe('Insurance Verification Contract', () => {
  const contract = mockClarity.contracts.insuranceVerification;
  
  beforeEach(() => {
    // Reset contract state before each test
    contract.insurancePolicies = new Map();
    contract.authorizedVerifiers = new Map();
    contract.init();
  });
  
  it('should register an insurance policy', () => {
    const result = contract.registerInsurancePolicy(1, 'POL123456', 'FloodSafe Insurance', 500000, 1000);
    
    expect(result).toEqual({ ok: true });
    expect(contract.insurancePolicies.get(1)).toEqual({
      policyNumber: 'POL123456',
      provider: 'FloodSafe Insurance',
      coverageAmount: 500000,
      expirationDate: 1000,
      verified: false,
      adequateCoverage: false
    });
  });
  
  it('should verify an insurance policy with adequate coverage', () => {
    // Register a policy
    contract.registerInsurancePolicy(1, 'POL123456', 'FloodSafe Insurance', 500000, 1000);
    
    // Verify the policy
    const result = contract.verifyInsurancePolicy(1, 50, 500000);
    
    expect(result).toEqual({ ok: true });
    expect(contract.insurancePolicies.get(1).verified).toBe(true);
    expect(contract.insurancePolicies.get(1).adequateCoverage).toBe(true);
  });
  
  it('should verify an insurance policy with inadequate coverage', () => {
    // Register a policy with low coverage
    contract.registerInsurancePolicy(1, 'POL123456', 'FloodSafe Insurance', 100000, 1000);
    
    // Verify the policy
    const result = contract.verifyInsurancePolicy(1, 80, 500000);
    
    expect(result).toEqual({ ok: false });
    expect(contract.insurancePolicies.get(1).verified).toBe(true);
    expect(contract.insurancePolicies.get(1).adequateCoverage).toBe(false);
  });
  
  it('should fail to verify an expired policy', () => {
    // Register a policy with an expiration date in the past
    contract.registerInsurancePolicy(1, 'POL123456', 'FloodSafe Insurance', 500000, 50);
    
    // Try to verify the expired policy
    const result = contract.verifyInsurancePolicy(1, 50, 500000);
    
    expect(result).toEqual({ err: 102 }); // ERR-EXPIRED-POLICY
  });
  
  it('should calculate required coverage based on risk and property value', () => {
    // Low risk (20)
    let requiredCoverage = contract.calculateRequiredCoverage(20, 1000000);
    expect(requiredCoverage).toBe(500000 + 20000); // 50% + 2% of property value
    
    // High risk (80)
    requiredCoverage = contract.calculateRequiredCoverage(80, 1000000);
    expect(requiredCoverage).toBe(500000 + 80000); // 50% + 8% of property value
  });
});
