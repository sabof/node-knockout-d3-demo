/*global Q, $, d3*/

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
          name: subsectorName
        });
      }
    }
  },

  // _currentDateWeightRequest: null,

  getDateWeights: function(date) {
    /*jshint newcap: false */

    // Cancel/return current request

    var existing = this._weightCache[date];
    if (existing) {
      return Q(existing);
    }
    var def = Q.defer();
    $.get(
      'api/something',
      function(data) {
        this._weightCache[date] = 'something';

      });
  },
  _getAllowedDates: null,
  getAllowedDates: function() {

  },

  // FIXME: auto-init?
  init: function() {
    var self = this;
    var def = $.Deferred();

    // var allowedDates;
    $.ajax({
      url: 'api/weightDates',
      async: false,
      success: function(result) {
        self._allowedDates = result;
      }
    });

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

// var margin = {top: 40, right: 10, bottom: 10, left: 10},
//     width = 960 - margin.left - margin.right,
//     height = 500 - margin.top - margin.bottom;

var color = d3.scale.category20c();

function valueFunc(d) {
  return Math.random();
  // return model._weightCache(d.name) || Math.random();
}

var treemap = d3.layout.treemap()
      .size([600, 600])
      .sticky(true) // ?
      .value(valueFunc);

var div = d3.select("#d3-box");
      // .style("position", "relative")
      // .style("width", (width + margin.left + margin.right) + "px")
      // .style("height", (height + margin.top + margin.bottom) + "px")
      // .style("left", margin.left + "px")
      // .style("top", margin.top + "px");

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

function getClosestDate() {

}

function getClosestMatch(value, candidates) {

  var bestScore = Number.MAX_VALUE,
      bestValue;
  candidates.forEach(function(candidate) {
    var currentScore = Math.abs(candidate - value);
    if (currentScore < bestScore) {
      bestScore = currentScore;
      bestValue = candidate;
    }
    return candidate;
  });
}

function setDate(date) {
  console.log(date);
}

var rangeInput = document.getElementById('date-range');
rangeInput.min = rangeInput.value = Date.parse(allowedDates[0]);
rangeInput.max = Date.parse(allowedDates[allowedDates.length -1]);

rangeInput.addEventListener('change', function() {
  /*jshint nonew:false */
  var dateString = (new Date(Number(rangeInput.value)))
        .toISOString()
        .match(/^[^T]+/)[0];

  setDate(dateString);
});
