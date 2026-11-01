import { RoadGraph } from '../src/graph/graph.js';
import { MultiStopOptimizer, MultiStopPoint } from '../src/matching/multiStop.js';

describe('Multi-Stop Pickup Ordering Engine (NN + 2-opt)', () => {
  const origin: MultiStopPoint = {
    id: 'origin',
    name: 'Malabe Tech Park',
    lat: 6.9040,
    lng: 79.9540,
  };

  const destination: MultiStopPoint = {
    id: 'dest',
    name: 'Colombo Fort CBD',
    lat: 6.9344,
    lng: 79.8428,
  };

  test('Nearest-Neighbour construction orders unvisited pickups from east to west along corridor', () => {
    // Deliberately scrambled stops between Malabe (79.954) and Fort (79.842)
    const scrambledStops: MultiStopPoint[] = [
      { id: 's-townhall', name: 'Town Hall', lat: 6.9157, lng: 79.8636 },
      { id: 's-battaramulla', name: 'Battaramulla', lat: 6.8980, lng: 79.9210 },
      { id: 's-borella', name: 'Borella', lat: 6.9147, lng: 79.8778 },
      { id: 's-rajagiriya', name: 'Rajagiriya', lat: 6.9094, lng: 79.8961 },
    ];

    const nnTour = MultiStopOptimizer.nearestNeighbourTour(origin, scrambledStops, destination, null);

    expect(nnTour).toHaveLength(6);
    expect(nnTour[0].id).toBe('origin');
    expect(nnTour[nnTour.length - 1].id).toBe('dest');
    // Nearest to Malabe is Battaramulla -> Rajagiriya -> Borella -> Town Hall
    expect(nnTour.map((p) => p.id)).toEqual([
      'origin',
      's-battaramulla',
      's-rajagiriya',
      's-borella',
      's-townhall',
      'dest',
    ]);
  });

  test('2-opt improvement eliminates zigzagging crossovers and reduces total tour distance', () => {
    // Construct a deliberately crossed tour (Origin -> Stop 3 -> Stop 1 -> Stop 2 -> Destination)
    const crossedTour: MultiStopPoint[] = [
      origin,
      { id: 's3', name: 'Borella', lat: 6.9147, lng: 79.8778 },
      { id: 's1', name: 'Battaramulla', lat: 6.8980, lng: 79.9210 },
      { id: 's2', name: 'Rajagiriya', lat: 6.9094, lng: 79.8961 },
      destination,
    ];

    const rawDist = MultiStopOptimizer.calculateTourDistance(crossedTour, null);
    const { tour: optimized, iterations } = MultiStopOptimizer.twoOptTour(crossedTour, 50, null);
    const optDist = MultiStopOptimizer.calculateTourDistance(optimized, null);

    expect(optDist).toBeLessThan(rawDist);
    expect(iterations).toBeGreaterThanOrEqual(1);
    expect(optimized[0].id).toBe('origin');
    expect(optimized[optimized.length - 1].id).toBe('dest');
  });

  test('optimizeMultiStopTour uses road graph cost oracle when RoadGraph is populated', () => {
    const graph = new RoadGraph();
    graph.addNode({ id: 'n1', lat: 6.9344, lng: 79.8428 }); // Fort
    graph.addNode({ id: 'n2', lat: 6.9065, lng: 79.8510 }); // Kollupitiya
    graph.addNode({ id: 'n3', lat: 6.8740, lng: 79.8590 }); // Wellawatte
    graph.addNode({ id: 'n4', lat: 6.7969, lng: 79.9018 }); // Moratuwa

    graph.addEdge({ id: 'e1', source: 'n1', target: 'n2', distanceM: 3200, speedKmh: 40, isOneway: false });
    graph.addEdge({ id: 'e2', source: 'n2', target: 'n3', distanceM: 3800, speedKmh: 40, isOneway: false });
    graph.addEdge({ id: 'e3', source: 'n3', target: 'n4', distanceM: 9500, speedKmh: 45, isOneway: false });

    const stops: MultiStopPoint[] = [
      { id: 'wellawatte', name: 'Wellawatte', lat: 6.8740, lng: 79.8590 },
      { id: 'kollupitiya', name: 'Kollupitiya', lat: 6.9065, lng: 79.8510 },
    ];

    const result = MultiStopOptimizer.optimizeMultiStopTour(
      { id: 'fort', name: 'Fort', lat: 6.9344, lng: 79.8428 },
      stops,
      { id: 'moratuwa', name: 'Moratuwa', lat: 6.7969, lng: 79.9018 },
      graph
    );

    expect(result.costMetric).toBe('road_graph');
    expect(result.optimizedDistanceM).toBeLessThanOrEqual(result.initialDistanceM);
    expect(result.orderedStops.map((s) => s.id)).toEqual([
      'fort',
      'kollupitiya',
      'wellawatte',
      'moratuwa',
    ]);
  });
});
