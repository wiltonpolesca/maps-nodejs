// TUTORIAL http://duspviz.mit.edu/tutorials/intro-postgis.php


var express = require('express'); // require Express
var router = express.Router(); // setup usage of the Express router engine

/* PostgreSQL and PostGIS module and connection setup */
const { Client, Query } = require('pg')

// Setup connection
var username = "postgres" // sandbox username
var password = "postgres" // read only privileges on our table
var host = "localhost:5432"
var database = "my-lab" // database name
var conString = "postgres://" + username + ":" + password + "@" + host + "/" + database; // Your Database Connection

/**

-- Script to create the table used

CREATE TABLE hm_map.coffee_shops
	(
	  id serial NOT NULL,
	  name character varying(50),
	  address character varying(50),
	  city character varying(50),
	  state character varying(50),
	  zip character varying(10),
	  lat numeric,
	  lon numeric
	);
  

  //Depois de carregado os dados no csv, criar coluna de geometria

  ALTER TABLE chm_map.offee_shops
	ADD COLUMN geom geometry(POINT,4326)


  //Atualizando a informação de coordenada para o formato postgis
  UPDATE hm_map.coffee_shops SET geom = ST_SetSRID(ST_MakePoint(lon,lat),4326);

//Criação de índice para agiliar as pesquisas

CREATE INDEX coffee_shops_gist
  ON hm_map.coffee_shops
  USING gist (geom);


  -- Number of Coffee Shops in a Neighborhood  
  SELECT cambridge_neighborhoods.name as name, count(*)
	FROM hm_map.coffee_shops, hm_map.cambridge_neighborhoods
	WHERE ST_Intersects(coffee_shops.geom, cambridge_neighborhoods.geom)
	GROUP BY cambridge_neighborhoods.name;


  --Order Coffee Shops by Distance to MIT
-- For our second task, order the coffee shops by distance to 77 Massachusetts Ave and return the name and address of the shop. The latitude and longitude at 77 Massachusetts Ave is 42.359055, -71.093500. To do this, we want to ORDER BY distance. We can use the distance operator (<->) in PostGIS to get us these values, and we need to make a point from our input latitude and longitude. Your query, as such, will look like the following.

  SELECT name, address
	FROM hm_map.coffee_shops
	ORDER BY geom <-> ST_SetSRID(ST_MakePoint(-71.093500,42.359055),4326);

-- Reproject a Dataset and find Coffee Shops within 500m of Harvard Square
  CREATE TABLE hm_map.coffee_shops_utm AS SELECT * FROM hm_map.coffee_shops;	

ALTER TABLE  hm_map.coffee_shops_utm
	ALTER COLUMN geom TYPE geometry(POINT,32619)
	USING ST_Transform(geom,32619);

 */

// Set up your database query to display GeoJSON
var coffee_query = `SELECT row_to_json(fc) 
                     FROM ( SELECT 'FeatureCollection' As type, 
                                   array_to_json(array_agg(f)) As features 
                              FROM (SELECT 'Feature' As type, 
                                           ST_AsGeoJSON(lg.geom)::json As geometry, 
                                           row_to_json((id, name)) As properties 
                                      FROM hm_map.coffee_shops As lg) As f) As fc`;

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

/* GET Postgres JSON data */
router.get('/data', function (req, res) {
  var client = new Client(conString);
  client.connect();
  var query = client.query(new Query(coffee_query));
  query.on("row", function (row, result) {
    result.addRow(row);
  });
  query.on("end", function (result) {
    res.send(result.rows[0].row_to_json);
    res.end();
  });
});

/* GET the map page */
router.get('/map', function (req, res) {
  var client = new Client(conString); // Setup our Postgres Client
  client.connect(); // connect to the client
  var query = client.query(new Query(coffee_query)); // Run our Query
  query.on("row", function (row, result) {
    result.addRow(row);
  });
  // Pass the result to the map page
  query.on("end", function (result) {
    var data = result.rows[0].row_to_json // Save the JSON as variable data
    res.render('map', {
      title: "Express API", // Give a title to our page
      jsonData: data // Pass data to the View
    });
  });
});

/* GET the filtered page */
router.get('/filter*', function (req, res) {
  var name = req.query.name;
  if (name.indexOf("--") > -1 || name.indexOf("'") > -1 || name.indexOf(";") > -1 || name.indexOf("/*") > -1 || name.indexOf("xp_") > -1){
      console.log("Bad request detected");
      res.redirect('/map');
      return;
  } else {
      console.log("Request passed")
      var filter_query = "SELECT row_to_json(fc) FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, name)) As properties FROM cambridge_coffee_shops As lg WHERE lg.name = \'" + name + "\') As f) As fc";
      var client = new pg.Client(conString);
      client.connect();
      var query = client.query(filter_query);
      query.on("row", function (row, result) {
          result.addRow(row);
      });
      query.on("end", function (result) {
          var data = result.rows[0].row_to_json
          res.render('map', {
              title: "Express API",
              jsonData: data
          });
      });
  };
});

module.exports = router;
