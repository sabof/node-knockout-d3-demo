/*global $, d3*/

var sectorMapRaw,
    sectorMap = {
      name: 'root',
      children: []
    };

$.ajax({
  url: 'api/sectors',
  // FIXME: Asynchronize
  async: false,
  success: function(result) {
    sectorMapRaw = result;
  }
});

function getSectorCreate(sectorName) {
  var object;

  sectorMap.children.some(function(it) {
    if (it.name === sectorName) {
      object = it;
      console.log();
      return true;
    }
  });

  if (! object) {
    object = {
      name: sectorName,
      children: []
    };
    sectorMap.children.push(object);
  }

  return object;
}

// FIXME?: keys -> for in

Object.keys(sectorMapRaw).forEach(function(subsectorName) {
  var sectorName = sectorMapRaw[subsectorName];
  var sector = getSectorCreate(sectorName);

  sector.children.push({
    name: subsectorName,
    // FIXME: Deleteable?
    children: []
  });
});

console.log(sectorMap);

// d3.select(fu);
