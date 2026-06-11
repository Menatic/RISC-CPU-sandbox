export type CacheConfig = {
  l1iSize: number;     // bytes
  l1dSize: number;
  l2Size: number;
  l3Size: number;
  blockSize: number;   // bytes per cache line
  l1Associativity: number;
  l2Associativity: number;
  l3Associativity: number;
  replacementPolicy: 'lru' | 'random' | 'fifo';
};

export type CacheAccess = {
  address: number;
  type: 'read' | 'write';
  level: 'L1I' | 'L1D' | 'L2' | 'L3' | 'DRAM';
  hit: boolean;
  evictedLine: number | null;
  cyclesCost: number;
};

export type CacheStats = {
  l1iHits: number; l1iMisses: number;
  l1dHits: number; l1dMisses: number;
  l2Hits: number; l2Misses: number;
  l3Hits: number; l3Misses: number;
};

export class CacheHierarchy {
  private stats: CacheStats = {
    l1iHits: 0, l1iMisses: 0,
    l1dHits: 0, l1dMisses: 0,
    l2Hits: 0, l2Misses: 0,
    l3Hits: 0, l3Misses: 0,
  };
  
  constructor(public config: CacheConfig) {}

  access(address: number, type: 'read' | 'write', instruction: boolean = false): CacheAccess {
    // Mock simulation
    const hit = Math.random() > 0.1; // 90% L1 hit rate
    
    if (hit) {
      if (instruction) this.stats.l1iHits++; else this.stats.l1dHits++;
      return { address, type, level: instruction ? 'L1I' : 'L1D', hit: true, evictedLine: null, cyclesCost: 4 };
    } else {
      if (instruction) this.stats.l1iMisses++; else this.stats.l1dMisses++;
      this.stats.l2Hits++; // Always hit L2 for mock
      return { address, type, level: 'L2', hit: true, evictedLine: address, cyclesCost: 16 };
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }
}
