//Deforestation Monitoring using Hansen Global Forest Change and RADD Alerts in Google Earth Engine//

/**
 * This script analyzes deforestation trends within a specified Area of Interest (AOI) 
 * by integrating two datasets: Hansen Global Forest Change and RADD Alerts.
 *
 * Objectives:
 * - Extract deforestation data from Hansen (tree cover loss) and RADD (radar-based deforestation alerts).
 * - Convert both datasets into binary masks (1 = deforestation, 0 = no deforestation).
 * - Merge the datasets to generate an integrated deforestation alert layer.
 * - Calculate and print the total deforested area (in hectares) from each dataset and the combined result.
 * - Visualize the deforestation patterns and AOI boundaries on the map.
 *
 * Data Sources:
 * - Hansen Global Forest Change (UMD/hansen/global_forest_change_2023_v1_11) [30m resolution]
 * - RADD Alerts (projects/radar-wur/raddalert/v1) [10m resolution]
 *
 * Outputs:
 * - Hansen-based deforestation area (in hectares).
 * - RADD-based deforestation area (in hectares).
 * - Integrated deforestation area (in hectares).
 * - A visual representation of the AOI and deforestation layers on the map.
 */

// Define the Area of Interest (AOI)
var AOI = ee.FeatureCollection("projects/kuncoro/assets/Kutai_Timur");

// Define the time range for analysis
var startYear = 2020;
var endYear = 2024;

// Load Hansen Global Forest Change Data
var hansen = ee.Image("UMD/hansen/global_forest_change_2023_v1_11");

// Filter Hansen Forest Loss data and clip it to the AOI
var hansen_loss = hansen.select('lossyear')
  .updateMask(hansen.select('lossyear').gte(startYear - 2000)) // Hansen loss year is relative to 2000
  .clip(AOI)
  .rename('deforestation'); // Rename band to 'deforestation' for consistency

// Load RADD Alerts dataset
var radd = ee.ImageCollection("projects/radar-wur/raddalert/v1")
  .filterBounds(AOI) // Filter to the AOI extent
  .filterDate(ee.Date.fromYMD(startYear, 1, 1), ee.Date.fromYMD(endYear, 12, 31)) // Filter alerts within the defined time range
  .select('Alert')
  .max()
  .clip(AOI)
  .rename('deforestation'); // Rename band to 'deforestation' for consistency

// Convert Hansen loss data into a binary mask (1 = loss, 0 = no loss)
var hansenBinary = hansen_loss.gt(0).selfMask();

// Convert RADD Alerts data into a binary mask (1 = alert, 0 = no alert)
var raddBinary = radd.gt(0).selfMask();

// Merge Hansen and RADD deforestation data
var combined_deforestation = ee.ImageCollection([
  hansenBinary, raddBinary
]).max().clip(AOI);

// Calculate pixel area in hectares (1 hectare = 10,000 square meters)
var pixelArea = ee.Image.pixelArea().divide(10000); // Convert square meters to hectares

// Calculate the deforestation area from Hansen data
var hansenArea = hansenBinary.multiply(pixelArea)
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: AOI,
    scale: 30, // Resolution of Hansen dataset (30m)
    maxPixels: 1e13
  }).get('deforestation');

// Calculate the deforestation area from RADD Alerts
var raddArea = raddBinary.multiply(pixelArea)
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: AOI,
    scale: 10, // Resolution of RADD dataset (10m)
    maxPixels: 1e13
  }).get('deforestation');

// Calculate the total deforestation area from the combined dataset
var combinedArea = combined_deforestation.multiply(pixelArea)
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: AOI,
    scale: 10, // Resolution of the dataset
    maxPixels: 1e13
  }).get('deforestation');

// Print deforestation area results
print('Hansen Deforestation Area (Hectares):', hansenArea);
print('RADD Deforestation Area (Hectares):', raddArea);
print('Integrated Deforestation Area (Hectares):', combinedArea);

// Visualization parameters for different layers
var vizParams = {
  min: 0,
  max: 1,
  palette: ['white', 'red'] // White for no deforestation, red for deforestation
};

var hansenVizParams = {
  min: startYear - 2000,
  max: endYear - 2000,
  palette: ['yellow', 'orange', 'red']
};

// Define AOI boundary
var boundaryStyle = {
  color: 'black',
  width: 2,
  fillColor: '00000000'
};

// Convert AOI to a feature collection and draw only the outline
var aoiOutline = ee.FeatureCollection(AOI);

// Add layers to the map
Map.centerObject(AOI, 11.5);
Map.addLayer(aoiOutline.style(boundaryStyle), {}, "AOI Boundary"); // AOI boundary outline
Map.addLayer(hansen_loss, hansenVizParams, "Hansen Forest Loss");
Map.addLayer(raddBinary, {palette: 'purple'}, "RADD Alerts");
Map.addLayer(combined_deforestation, vizParams, "Integrated Deforestation Alerts");