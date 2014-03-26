/*global $, d3*/

var model = {
  _sectorMap: {
    name: 'root',
    children: []
  },

  _getSectorCreate: function(sectorName) {
    var object;

    this._sectorMap.children.some(function(it) {
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
      this._sectorMap.children.push(object);
    }

    return object;
  },

  _populate: function(sectorMapRaw) {
    for (var subsectorName in sectorMapRaw) {
      if (sectorMapRaw.hasOwnProperty(subsectorName)) {
        var sectorName = sectorMapRaw[subsectorName];
        var sector = this._getSectorCreate(sectorName);

        sector.children.push({
          name: subsectorName,
          // FIXME: Deleteable?
          // children: []
          size: Math.random()
        });
      }
    }

    // FIXME?: keys -> for in
    Object.keys(sectorMapRaw).forEach(function(subsectorName) {

    });
  },

  init: function() {
    var self = this;
    var def = $.Deferred();
    $.ajax({
      url: 'api/sectors',
      success: function(result) {
        self._populate(result);
        def.resolve();
      }
    });
    return def.promise();
  }
};

// D3

function position() {
  this.style("left", function(d) { return d.x + "px"; })
    .style("top", function(d) { return d.y + "px"; })
    .style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
    .style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; });
}

var margin = {top: 40, right: 10, bottom: 10, left: 10},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var color = d3.scale.category20c();

var treemap = d3.layout.treemap()
      .size([width, height])
      .sticky(true) // ?
      .value(function(d) { return d.size; });

var div = d3.select("#d3-box")
      .style("position", "relative")
      .style("width", (width + margin.left + margin.right) + "px")
      .style("height", (height + margin.top + margin.bottom) + "px")
      .style("left", margin.left + "px")
      .style("top", margin.top + "px");

// FIXME: Refactor to data-specific defferreds?
$.when( model.init() ).then(function() {
  var node = div.datum(model._sectorMap).selectAll(".node")
        .data(treemap.nodes)
        .enter().append("div")
        .attr("class", "node")
        .call(position)
        .style("background", function(d) { return d.children ? color(d.name) : null; })
      .text(function(d) { return d.children ? null : d.name; });

});
