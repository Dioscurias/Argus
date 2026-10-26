import type { LayerDefinition } from './types';
import { IconLayer } from '@deck.gl/layers';
import type { Entity } from '../../shared/schema';
import type { PickingInfo } from '@deck.gl/core';
export const airLayer: LayerDefinition = { id: 'air', name: 'Air traffic', description: 'Aircraft positions · hover for details', icon: 'air', color: '#4C90F0', provenance: 'LIVE', phase: 1, defaultVisible: true, transport: 'air', filters: ['Altitude band', 'Aircraft type'] };

export function createAircraftLayer(data: Entity[], visible: boolean, opacity: number, onHover: (info: PickingInfo<Entity>) => void) {
  return new IconLayer<Entity, { beforeId: string }>({
    id: 'aircraft', data, visible, opacity, pickable: true,
    beforeId: 'air-anchor',
    iconAtlas: '/aircraft.svg', iconMapping: { aircraft: { x: 0, y: 0, width: 64, height: 64, anchorX: 32, anchorY: 32, mask: true } },
    getIcon: () => 'aircraft', getPosition: entity => [entity.lon, entity.lat],
    getSize: 14, sizeUnits: 'pixels', sizeMinPixels: 11, sizeMaxPixels: 20,
    getAngle: entity => -entity.heading, getColor: entity => entity.provenance === 'DELAYED' ? [132, 152, 176, 190] : [76, 144, 240, 235],
    billboard: false, onHover,
    parameters: { depthWriteEnabled: false },
  });
}
