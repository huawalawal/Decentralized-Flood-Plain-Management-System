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
    riskAssessment: {
      riskAssessments: new Map(),
      authorizedAssessors: new Map(),
      
      // Constants
      LOW_RISK_THRESHOLD: 30,
      MEDIUM_RISK_THRESHOLD: 70,
      HIGH_RISK_THRESHOLD: 90,
      
      // Initialize contract owner as authorized assessor
      init: function() {
        this.authorizedAssessors.set(mockClarity.tx.sender, { authorized: true });
      },
      
      addAuthorizedAssessor: function(assessor) {
        if (mockClarity.tx.sender !== 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM') {
          return { err: 100 }; // ERR-NOT-AUTHORIZED
        }
        
        this.authorizedAssessors.set(assessor, { authorized: true });
        return { ok: true };
      },
      
      removeAuthorizedAssessor: function(assessor) {
        if (mockClarity.tx.sender !== 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM') {
          return { err: 100 }; // ERR-NOT-AUTHORIZED
        }
        
        this.authorizedAssessors.set(assessor, { authorized: false });
        return { ok: true };
      },
      
      isAuthorizedAssessor: function(assessor) {
        const assessorData = this.authorizedAssessors.get(assessor);
        return assessorData ? assessorData.authorized : false;
      },
      
      assessRisk: function(propertyId, elevation, floodHistoryCount) {
        const caller = mockClarity.tx.sender;
        
        if (!this.isAuthorizedAssessor(caller)) {
          return { err: 100 }; // ERR-NOT-AUTHORIZED
        }
        
        const elevationFactor = elevation < 10 ? 50 : (elevation < 30 ? 30 : 10);
        const historyFactor = floodHistoryCount * 10;
        const riskScore = elevationFactor + historyFactor;
        
        if (riskScore > 100) {
          return { err: 101 }; // ERR-INVALID-SCORE
        }
        
        const highRisk = riskScore > this.HIGH_RISK_THRESHOLD;
        
        this.riskAssessments.set(propertyId, {
          riskScore,
          floodHistoryCount,
          lastAssessmentDate: mockClarity.block.height,
          highRisk
        });
        
        return { ok: riskScore };
      },
      
      recordFloodEvent: function(propertyId) {
        const caller = mockClarity.tx.sender;
        
        if (!this.isAuthorizedAssessor(caller)) {
          return { err: 100 }; // ERR-NOT-AUTHORIZED
        }
        
        const existingAssessment = this.riskAssessments.get(propertyId) || {
          riskScore: 0,
          floodHistoryCount: 0,
          lastAssessmentDate: 0,
          highRisk: false
        };
        
        const newFloodCount = existingAssessment.floodHistoryCount + 1;
        
        this.riskAssessments.set(propertyId, {
          ...existingAssessment,
          floodHistoryCount: newFloodCount
        });
        
        return { ok: newFloodCount };
      },
      
      getRiskAssessment: function(propertyId) {
        return this.riskAssessments.get(propertyId);
      },
      
      isHighRisk: function(propertyId) {
        const assessment = this.riskAssessments.get(propertyId);
        return assessment ? assessment.highRisk : false;
      }
    }
  }
};

// Tests for Risk Assessment Contract
describe('Risk Assessment Contract', () => {
  const contract = mockClarity.contracts.riskAssessment;
  
  beforeEach(() => {
    // Reset contract state before each test
    contract.riskAssessments = new Map();
    contract.authorizedAssessors = new Map();
    contract.init();
  });
  
  it('should assess risk for a property', () => {
    const result = contract.assessRisk(1, 5, 2);
    
    expect(result).toEqual({ ok: 70 }); // 50 (elevation) + 20 (history)
    expect(contract.riskAssessments.get(1)).toEqual({
      riskScore: 70,
      floodHistoryCount: 2,
      lastAssessmentDate: mockClarity.block.height,
      highRisk: false
    });
  });
  
  it('should mark property as high risk when score exceeds threshold', () => {
    const result = contract.assessRisk(1, 5, 5);
    
    expect(result).toEqual({ ok: 100 }); // 50 (elevation) + 50 (history)
    expect(contract.riskAssessments.get(1).highRisk).toBe(true);
  });
  
  it('should fail to assess risk if not authorized', () => {
    // Change the sender to an unauthorized user
    const originalSender = mockClarity.tx.sender;
    mockClarity.tx.sender = 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    
    const result = contract.assessRisk(1, 5, 2);
    
    expect(result).toEqual({ err: 100 }); // ERR-NOT-AUTHORIZED
    
    // Restore the original sender
    mockClarity.tx.sender = originalSender;
  });
  
  it('should record a flood event', () => {
    // First create an assessment
    contract.assessRisk(1, 5, 2);
    
    // Then record a flood event
    const result = contract.recordFloodEvent(1);
    
    expect(result).toEqual({ ok: 3 });
    expect(contract.riskAssessments.get(1).floodHistoryCount).toBe(3);
  });
  
  it('should add and remove authorized assessors', () => {
    const newAssessor = 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    
    // Add a new assessor
    let result = contract.addAuthorizedAssessor(newAssessor);
    expect(result).toEqual({ ok: true });
    expect(contract.isAuthorizedAssessor(newAssessor)).toBe(true);
    
    // Remove the assessor
    result = contract.removeAuthorizedAssessor(newAssessor);
    expect(result).toEqual({ ok: true });
    expect(contract.isAuthorizedAssessor(newAssessor)).toBe(false);
  });
});
