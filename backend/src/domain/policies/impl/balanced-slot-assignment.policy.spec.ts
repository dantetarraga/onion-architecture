import { Branch, BranchProps } from '../../entities/branch.entity';
import {
  ParkingSlot,
  ParkingSlotProps,
} from '../../entities/parking-slot.entity';
import { SlotStatus } from '../../enums/slot-status.enum';
import { SlotType } from '../../enums/slot-type.enum';
import { BranchRepositoryPort } from '../../ports/branch.repository.port';
import { ParkingSlotRepositoryPort } from '../../ports/parking-slot.repository.port';
import { BalancedSlotAssignmentPolicy } from './balanced-slot-assignment.policy';

function buildBranch(overrides: Partial<BranchProps> = {}): Branch {
  return new Branch({
    id: 'branch-1',
    name: 'Sucursal 1',
    address: 'Direccion 1',
    lat: 0,
    lng: 0,
    pricePerHour: 5,
    createdAt: new Date(),
    ...overrides,
  });
}

function buildSlot(overrides: Partial<ParkingSlotProps> = {}): ParkingSlot {
  return new ParkingSlot({
    id: 'slot-1',
    branchId: 'branch-1',
    code: 'REG-01',
    type: SlotType.REGULAR,
    status: SlotStatus.DISPONIBLE,
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('BalancedSlotAssignmentPolicy', () => {
  const slotsRepo: jest.Mocked<ParkingSlotRepositoryPort> = {
    findById: jest.fn(),
    countByBranchAndType: jest.fn(),
    hasAvailability: jest.fn(),
    claimAvailableSlot: jest.fn(),
    claimLeastRecentlyUsedSlot: jest.fn(),
    updateStatus: jest.fn(),
    getOccupancySummary: jest.fn(),
    markAllOccupied: jest.fn(),
  };
  const branchesRepo: jest.Mocked<BranchRepositoryPort> = {
    findById: jest.fn(),
    findAll: jest.fn(),
    findByIds: jest.fn(),
    findAllExcept: jest.fn(),
  };

  let policy: BalancedSlotAssignmentPolicy;

  beforeEach(() => {
    jest.clearAllMocks();
    policy = new BalancedSlotAssignmentPolicy(slotsRepo, branchesRepo);
  });

  it('asigna la cochera menos usada recientemente cuando hay cupo en la sucursal solicitada', async () => {
    const slot = buildSlot();
    slotsRepo.claimLeastRecentlyUsedSlot.mockResolvedValue(slot);

    const result = await policy.assign({
      branchId: 'branch-1',
      slotType: SlotType.REGULAR,
    });

    expect(result).toEqual({ outcome: 'ASSIGNED', slot });
    expect(slotsRepo.claimLeastRecentlyUsedSlot).toHaveBeenCalledWith(
      'branch-1',
      SlotType.REGULAR,
    );
    expect(branchesRepo.findAllExcept).not.toHaveBeenCalled();
  });

  it('prefiere una sucursal mas lejana pero menos ocupada por sobre la mas cercana y casi llena', async () => {
    slotsRepo.claimLeastRecentlyUsedSlot.mockResolvedValue(null);
    const currentBranch = buildBranch({ id: 'branch-1', lat: 0, lng: 0 });
    const nearButFullBranch = buildBranch({
      id: 'branch-2',
      lat: 0,
      lng: 0.01,
    });
    const farButEmptyBranch = buildBranch({
      id: 'branch-3',
      lat: 0,
      lng: 0.05,
    });
    branchesRepo.findById.mockResolvedValue(currentBranch);
    branchesRepo.findAllExcept.mockResolvedValue([
      nearButFullBranch,
      farButEmptyBranch,
    ]);
    slotsRepo.hasAvailability.mockResolvedValue(true);
    slotsRepo.getOccupancySummary.mockResolvedValue([
      { branchId: 'branch-2', totalSlots: 10, occupiedOrReserved: 10 },
      { branchId: 'branch-3', totalSlots: 10, occupiedOrReserved: 0 },
    ]);

    const result = await policy.assign({
      branchId: 'branch-1',
      slotType: SlotType.REGULAR,
    });

    expect(result.outcome).toBe('SUGGEST_OTHER_BRANCH');
    if (result.outcome === 'SUGGEST_OTHER_BRANCH') {
      expect(result.suggestedBranch.id).toBe('branch-3');
    }
  });

  it('informa que no hay disponibilidad si ninguna sucursal cercana tiene cupo', async () => {
    slotsRepo.claimLeastRecentlyUsedSlot.mockResolvedValue(null);
    branchesRepo.findById.mockResolvedValue(buildBranch());
    branchesRepo.findAllExcept.mockResolvedValue([
      buildBranch({ id: 'branch-2' }),
    ]);
    slotsRepo.hasAvailability.mockResolvedValue(false);

    const result = await policy.assign({ branchId: 'branch-1' });

    expect(result).toEqual({ outcome: 'NO_AVAILABILITY' });
    expect(slotsRepo.getOccupancySummary).not.toHaveBeenCalled();
  });
});
