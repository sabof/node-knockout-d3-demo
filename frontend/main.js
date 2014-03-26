/*global ko, Q, $, d3*/

var utils = {
  getClosestMatch: function(value, candidates) {
    var bestScore = Number.MAX_VALUE,
        bestValue;

    // FIXME: Can be optimized, so iteration stops when values start getting worse.
    candidates.forEach(function(candidate) {
      var currentScore = Math.abs(candidate - value);
      if (currentScore < bestScore) {
        bestScore = currentScore;
        bestValue = candidate;
      }
    });
    return bestValue;
  }
};

var model = {
  fetchWeights: function(date) {
    // FIXME: Allows concurrent requests to the same resource?
    var self = this;
    if (this.weights()[date]) {
      return;
    }
    $.get(
      'api/weights/' + date,
      function(data) {
        self.weights()[date] = data;
      });
  },

  _initBindings: function() {
    this.allowedDates = ko.observable([]);
    this.weights = ko.observable({});
    this.initialDate = ko.observable();
    this.sectorMap = ko.observable();
  },

  _fetchInitialPayload: function() {
    var self = this;
    $.get(
      'api/initialPayload/',
      function(data) {
        self.allowedDates(data.dates);

        var weights = self.weights();
        weights[data.initialDate] = data.initialData;
        self.weights.valueHasMutated();

        self.initialDate(data.initialDate);
        self.sectorMap(data.sectors);
      }
    );
  },

  init: function() {
    this._initBindings();
    this._fetchInitialPayload();
  }

};

var view = {
  model: model,

  _initBindings: function() {
    var self = this;

    this.sliderValue = ko.observable();
    this.sliderMin = ko.computed(function() {
      var dates = self.model.allowedDates();
      return dates ? dates[0] : null;
    });

    this.sliderMax = ko.computed(function() {
      var dates = self.model.allowedDates();
      return dates ? dates[dates.length - 1] : null;
    });

    this.lastAvailableDate = ko.observable();
    this.currentDate = ko.computed(function() {
      var sliderValue = self.sliderValue();
      var allowedDates = self.model.allowedDates();
      if (! (sliderValue && allowedDates)) {
        return;
      }

      var newVal =  utils.getClosestMatch(
        sliderValue, allowedDates
      );

      self.model.fetchWeights(newVal);
      return newVal;
    });

    this.currentDate.subscribe(function(oldValue) {
      if (self.model.weights()[oldValue]) {
        self.lastAvailableDate(oldValue);
      }
    }, null, 'beforeChange');

    // FIXME: Hacky?
    this.model.initialDate.subscribe(function(newValue) {
      self.sliderValue(newValue);
    });

    this.displayedWeightData = ko.computed(function() {
      var current = self.currentDate();
      var previous = self.lastAvailableDate();
      var weights = self.model.weights();

      return weights[current] ||
        weights[previous] ||
        false;
    });

    this.dateLabel = ko.computed(function() {
      var current = self.currentDate();
      if (! current) {
        return;
      }
      return (new Date(Number(current)))
        .toISOString()
        .match(/^[^T]+/)[0];
    });
  },

  init: function() {
    this._initBindings();
  }
};

// D3
var d3View = {
  initD3: function() {
    function position() {
      this.style("left", function(d) { return d.x + "px"; })
        .style("top", function(d) { return d.y + "px"; })
        .style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
        .style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; });
    }

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
  },
  init: function() {

  }
};

model.init();
view.init();
ko.applyBindings(view);
