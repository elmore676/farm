import { Cage, Cycle, Equipment, CageStatus, CycleStatus, EquipmentStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { ApiError } from '../utils/apiError';

const mapCageToFrontend = (cage: Cage & { cycles: Cycle[]; equipment: Equipment[] }) => {
    const activeCycle = cage.cycles.find(c => c.status === CycleStatus.active);
    const species = activeCycle?.species || cage.species || 'Unknown';
    const currentStock = cage.currentStock ?? activeCycle?.initialStock ?? 0;

    // Construct location object
    let location = { lat: -1.2921, lng: 36.8219, label: 'Lake Victoria' };
    if (cage.lat !== null && cage.lng !== null) {
        location = {
            lat: cage.lat,
            lng: cage.lng,
            label: cage.locationLabel || 'Location',
        };
    } else if (cage.location) {
        // Fallback to legacy string parsing
        const parts = cage.location.split(',');
        if (parts.length >= 2) {
            location = {
                lat: parseFloat(parts[0]),
                lng: parseFloat(parts[1]),
                label: parts[2] || 'Location',
            };
        }
    }

    // Construct dimensions object
    const dimensions = {
        length: cage.length || 10,
        width: cage.width || 10,
        depth: cage.depth || 5,
    };

    return {
        id: cage.id,
        code: cage.code || `CG-${cage.id.substring(0, 4).toUpperCase()}`,
        name: cage.name,
        species,
        capacity: cage.capacity || 0,
        currentStock,
        dimensions,
        location,
        status: (cage.status || CageStatus.idle) as 'active' | 'idle' | 'maintenance',
        currentCycle: activeCycle ? {
            id: activeCycle.id,
            startDate: activeCycle.startDate.toISOString(),
            expectedHarvest: activeCycle.endDate?.toISOString() || '',
            stockCount: currentStock,
            avgWeight: 0,
        } : undefined,
        equipment: cage.equipment.map((eq) => ({
            id: eq.id,
            name: eq.name,
            type: eq.type,
            status: eq.status,
            lastMaintenance: eq.lastMaintenance?.toISOString(),
            nextMaintenance: eq.nextMaintenance?.toISOString(),
        })),
        photos: cage.photos || [],
    };
};

export const cageService = {
    async list() {
        const cages = await prisma.cage.findMany({
            include: { cycles: true, equipment: true },
            orderBy: { createdAt: 'desc' },
        });
        return cages.map(mapCageToFrontend);
    },

    async create(data: any) {
        // Handle location: object or string
        let lat = -1.2921, lng = 36.8219, label = 'Lake Victoria';
        let legacyLocation = '';

        if (typeof data.location === 'string') {
            legacyLocation = data.location;
            const parts = data.location.split(',');
            if (parts.length >= 2) {
                lat = parseFloat(parts[0]);
                lng = parseFloat(parts[1]);
                label = parts[2] || '';
            }
        } else if (data.location) {
            lat = data.location.lat;
            lng = data.location.lng;
            label = data.location.label;
            legacyLocation = `${lat},${lng},${label}`;
        }

        const cage = await prisma.cage.create({
            data: {
                name: data.name,
                species: data.species,
                currentStock: data.currentStock ?? 0,
                location: legacyLocation,
                lat,
                lng,
                locationLabel: label,
                capacity: Number(data.capacity),
                status: (data.status as CageStatus) || CageStatus.idle,
                length: data.dimensions?.length,
                width: data.dimensions?.width,
                depth: data.dimensions?.depth,
                photos: data.photos || [],
                code: data.code,
                equipment: {
                    create: (data.equipment || []).map((eq: any) => ({
                        name: eq.name,
                        type: eq.type,
                        status: (eq.status as any) || EquipmentStatus.operational,
                        lastMaintenance: eq.lastMaintenance ? new Date(eq.lastMaintenance) : undefined,
                        nextMaintenance: eq.nextMaintenance ? new Date(eq.nextMaintenance) : undefined,
                    })),
                },
            },
            include: { cycles: true, equipment: true },
        });
        return mapCageToFrontend(cage);
    },

    async getById(id: string) {
        const cage = await prisma.cage.findUnique({
            where: { id },
            include: { cycles: true, equipment: true },
        });
        if (!cage) throw new ApiError(404, 'Cage not found');
        return mapCageToFrontend(cage);
    },

    async update(id: string, data: any) {
        const existing = await prisma.cage.findUnique({ where: { id }, include: { equipment: true } });
        if (!existing) throw new ApiError(404, 'Cage not found');

        const updateData: any = {
            name: data.name,
            species: data.species,
            currentStock: data.currentStock,
            capacity: data.capacity,
            status: data.status,
            photos: data.photos,
            code: data.code,
        };

        if (data.location) {
            if (typeof data.location === 'string') {
                updateData.location = data.location;
                const parts = data.location.split(',');
                if (parts.length >= 2) {
                    updateData.lat = parseFloat(parts[0]);
                    updateData.lng = parseFloat(parts[1]);
                    updateData.locationLabel = parts[2] || '';
                }
            } else {
                updateData.lat = data.location.lat;
                updateData.lng = data.location.lng;
                updateData.locationLabel = data.location.label;
                updateData.location = `${data.location.lat},${data.location.lng},${data.location.label}`;
            }
        }

        if (data.dimensions) {
            updateData.length = data.dimensions.length;
            updateData.width = data.dimensions.width;
            updateData.depth = data.dimensions.depth;
        }

        const updated = await prisma.cage.update({
            where: { id },
            data: {
                ...updateData,
                equipment: data.equipment
                    ? {
                        deleteMany: {},
                        create: data.equipment.map((eq: any) => ({
                            name: eq.name,
                            type: eq.type,
                            status: (eq.status as any) || EquipmentStatus.operational,
                            lastMaintenance: eq.lastMaintenance ? new Date(eq.lastMaintenance) : undefined,
                            nextMaintenance: eq.nextMaintenance ? new Date(eq.nextMaintenance) : undefined,
                        })),
                    }
                    : undefined,
            },
            include: { cycles: true, equipment: true },
        });
        return mapCageToFrontend(updated);
    },

    async delete(id: string) {
        const existing = await prisma.cage.findUnique({ where: { id } });
        if (!existing) throw new ApiError(404, 'Cage not found');
        return prisma.cage.delete({ where: { id } });
    }
};
