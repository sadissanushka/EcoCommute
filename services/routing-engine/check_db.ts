import { pool } from './src/graph/db.js';

async function check() {
  const sampleEdge = await pool.query(`
    SELECT e.source, e.target, e.distance_m,
           ST_Y(n1.geom) as src_lat, ST_X(n1.geom) as src_lng,
           ST_Y(n2.geom) as tgt_lat, ST_X(n2.geom) as tgt_lng
    FROM road_edges e
    JOIN road_nodes n1 ON e.source = n1.id
    JOIN road_nodes n2 ON e.target = n2.id
    LIMIT 5;
  `);
  console.log('Sample edges with coords:', sampleEdge.rows);

  // Check top connected nodes
  const topNodes = await pool.query(`
    SELECT source, count(*) as degree, ST_Y(n.geom) as lat, ST_X(n.geom) as lng
    FROM road_edges e
    JOIN road_nodes n ON e.source = n.id
    GROUP BY source, n.geom
    ORDER BY degree DESC
    LIMIT 5;
  `);
  console.log('Top degree nodes:', topNodes.rows);

  await pool.end();
}

check();
