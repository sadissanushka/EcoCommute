import { RoadGraph } from './graph.js';

export const COLOMBO_SEED_NODES = [
  { id: 'fort', name: 'Colombo Fort (CBD Gate 1)', lat: 6.9344, lng: 79.8428 },
  { id: 'galle_face', name: 'Galle Face Center Rd', lat: 6.9220, lng: 79.8490 },
  { id: 'kollupitiya', name: 'Kollupitiya Junction', lat: 6.9065, lng: 79.8510 },
  { id: 'cinnamon_gardens', name: 'Colombo 07 (Cinnamon Gardens)', lat: 6.9050, lng: 79.8700 },
  { id: 'bambalapitiya', name: 'Bambalapitiya Junction', lat: 6.8920, lng: 79.8550 },
  { id: 'borella', name: 'Borella Junction', lat: 6.9150, lng: 79.8780 },
  { id: 'rajagiriya', name: 'Rajagiriya Gateway', lat: 6.9090, lng: 79.8940 },
  { id: 'battaramulla', name: 'Battaramulla IT/Admin Hub', lat: 6.8980, lng: 79.9210 },
  { id: 'wellawatte', name: 'Wellawatte Canal Corridor', lat: 6.8740, lng: 79.8590 },
  { id: 'nugegoda', name: 'Nugegoda Flyover', lat: 6.8650, lng: 79.8970 },
  { id: 'dehiwala', name: 'Dehiwala Marine Drive', lat: 6.8520, lng: 79.8640 },
  { id: 'mount_lavinia', name: 'Mount Lavinia Hotel Rd', lat: 6.8350, lng: 79.8670 },
  { id: 'ratmalana', name: 'Ratmalana Airport Hub', lat: 6.8200, lng: 79.8730 },
  { id: 'maharagama', name: 'Maharagama Clock Tower', lat: 6.8480, lng: 79.9270 },
  { id: 'kottawa', name: 'Kottawa Expressway Hub', lat: 6.8410, lng: 79.9650 },
  { id: 'moratuwa_town', name: 'Moratuwa Town Cross', lat: 6.7730, lng: 79.8820 },
  { id: 'uom', name: 'University of Moratuwa (Katubedda)', lat: 6.7969, lng: 79.9018 },
  { id: 'malabe', name: 'Malabe Tech Horizon', lat: 6.9040, lng: 79.9540 },
  { id: 'homagama', name: 'Homagama Green Tech City', lat: 6.8420, lng: 80.0020 },
];

export const COLOMBO_SEED_EDGES = [
  { id: 'e1', source: 'fort', target: 'galle_face', distanceM: 1600, speedKmh: 45, isOneway: false },
  { id: 'e2', source: 'galle_face', target: 'kollupitiya', distanceM: 1800, speedKmh: 50, isOneway: false },
  { id: 'e3', source: 'kollupitiya', target: 'bambalapitiya', distanceM: 1700, speedKmh: 45, isOneway: false },
  { id: 'e4', source: 'kollupitiya', target: 'cinnamon_gardens', distanceM: 2200, speedKmh: 40, isOneway: false },
  { id: 'e5', source: 'fort', target: 'borella', distanceM: 4300, speedKmh: 45, isOneway: false },
  { id: 'e6', source: 'cinnamon_gardens', target: 'borella', distanceM: 1500, speedKmh: 40, isOneway: false },
  { id: 'e7', source: 'borella', target: 'rajagiriya', distanceM: 2100, speedKmh: 50, isOneway: false },
  { id: 'e8', source: 'rajagiriya', target: 'battaramulla', distanceM: 3200, speedKmh: 55, isOneway: false },
  { id: 'e9', source: 'battaramulla', target: 'malabe', distanceM: 3800, speedKmh: 55, isOneway: false },
  { id: 'e10', source: 'bambalapitiya', target: 'wellawatte', distanceM: 2100, speedKmh: 45, isOneway: false },
  { id: 'e11', source: 'bambalapitiya', target: 'nugegoda', distanceM: 5100, speedKmh: 45, isOneway: false },
  { id: 'e12', source: 'cinnamon_gardens', target: 'nugegoda', distanceM: 5400, speedKmh: 45, isOneway: false },
  { id: 'e13', source: 'wellawatte', target: 'dehiwala', distanceM: 2500, speedKmh: 45, isOneway: false },
  { id: 'e14', source: 'dehiwala', target: 'mount_lavinia', distanceM: 1900, speedKmh: 45, isOneway: false },
  { id: 'e15', source: 'mount_lavinia', target: 'ratmalana', distanceM: 1800, speedKmh: 50, isOneway: false },
  { id: 'e16', source: 'ratmalana', target: 'moratuwa_town', distanceM: 5300, speedKmh: 50, isOneway: false },
  { id: 'e17', source: 'ratmalana', target: 'uom', distanceM: 3900, speedKmh: 40, isOneway: false },
  { id: 'e18', source: 'moratuwa_town', target: 'uom', distanceM: 3100, speedKmh: 40, isOneway: false },
  { id: 'e19', source: 'nugegoda', target: 'maharagama', distanceM: 3800, speedKmh: 50, isOneway: false },
  { id: 'e20', source: 'maharagama', target: 'kottawa', distanceM: 4200, speedKmh: 55, isOneway: false },
  { id: 'e21', source: 'kottawa', target: 'homagama', distanceM: 4500, speedKmh: 60, isOneway: false },
  { id: 'e22', source: 'kottawa', target: 'uom', distanceM: 8900, speedKmh: 55, isOneway: false },
  { id: 'e23', source: 'rajagiriya', target: 'nugegoda', distanceM: 5200, speedKmh: 45, isOneway: false },
  { id: 'e24', source: 'battaramulla', target: 'kottawa', distanceM: 7800, speedKmh: 60, isOneway: false },
];

export function seedColomboNetworkIntoGraph(graph: RoadGraph): void {
  for (const node of COLOMBO_SEED_NODES) {
    graph.addNode({
      id: node.id,
      lat: node.lat,
      lng: node.lng,
    });
  }

  for (const edge of COLOMBO_SEED_EDGES) {
    graph.addEdge({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      distanceM: edge.distanceM,
      speedKmh: edge.speedKmh,
      isOneway: edge.isOneway,
    });
  }
}
