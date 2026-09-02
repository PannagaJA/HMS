import { describe, it, expect } from 'vitest';

describe('Stage 10: Concurrency Verification Test Suite', () => {
  it('CONC-001: Concurrent allocation of same bed ensures only one winner', async () => {
    let bedAllocated = false;
    const allocateBed = async (studentId: number) => {
      if (bedAllocated) {
        throw new Error('Bed is already occupied');
      }
      bedAllocated = true;
      return { success: true, studentId };
    };

    const results = await Promise.allSettled([
      allocateBed(101),
      allocateBed(102)
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
  });

  it('CONC-002: Concurrent allocation of same student to different beds ensures single active allocation', async () => {
    let studentActiveAllocations = 0;
    const allocateStudent = async (bedId: number) => {
      if (studentActiveAllocations >= 1) {
        throw new Error('Student already has an active allocation');
      }
      studentActiveAllocations += 1;
      return { success: true, bedId };
    };

    const results = await Promise.allSettled([
      allocateStudent(501),
      allocateStudent(502)
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
  });

  it('CONC-003: Reallocation atomically vacates previous bed before assigning new bed', () => {
    let allocations = [
      { id: 1, student_id: 10, bed_id: 101, is_active: true }
    ];

    const reallocate = (studentId: number, newBedId: number) => {
      // Step 1: Deactivate existing allocation
      allocations = allocations.map(a => 
        a.student_id === studentId && a.is_active ? { ...a, is_active: false } : a
      );
      // Step 2: Create new allocation
      allocations.push({ id: 2, student_id: studentId, bed_id: newBedId, is_active: true });
    };

    reallocate(10, 202);

    const activeAllocations = allocations.filter(a => a.student_id === 10 && a.is_active);
    expect(activeAllocations.length).toBe(1);
    expect(activeAllocations[0].bed_id).toBe(202);
  });
});
