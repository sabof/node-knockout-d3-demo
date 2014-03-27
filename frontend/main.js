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
        self.weights.valueHasMutated();
      });
  },

  _initBindings: function() {
    this.allowedDates = ko.observable([]);
    this.weights = ko.observable({});
    this.initialDate = ko.observable();
    this.sectorMap = ko.observable({});
    this.dataInitialized = ko.observable();
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
        self.dataInitialized(true);
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

    this.currentDate = ko.computed({
      read: function() {
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
      },
      write: self.sliderValue
    });

    this.currentDate.subscribe(function(oldValue) {
      if (self.model.weights()[oldValue]) {
        self.lastAvailableDate(oldValue);
      }
    }, null, 'beforeChange');

    this.model.initialDate.subscribe(function(newValue) {
      self.currentDate(newValue);
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
  view: view,

  update: function() {
    this.node
      .data(this.treemap.value(this._valueFunc).nodes)
      .transition()
      .duration(1500)
      .call(this._position);
  },

  _position: function() {
    this.style("left", function(d) { return d.x + "px"; })
      .style("top", function(d) { return d.y + "px"; })
      .style("width", function(d) { return d.dx + "px"; })
      .style("height", function(d) { return d.dy + "px"; })
      .style('display', function(d) {
        return (d.dx && d.dy) ? 'block' : 'none';
      });
  },

  initD3: function() {
    var self = this;
    this._valueFunc = function(d) {
      var fromData = self.view.displayedWeightData()[d.name];
      return fromData ? fromData.Weight : 0;
    };

    function text(d) {
      if (d.children) {
        return null;
      } else {
        return d.name.slice(0, 1) + d.name.slice(1).toLowerCase();
      }
    }

    this.root = d3.select("#d3-box");

    var color = d3.scale.category20b();

    this.treemap = d3.layout.treemap()
      .size([600, 600])
      .sticky(true) // ?
      .value(this._valueFunc);

    this.node = self.root
      .datum(this.view.model.sectorMap())
      .selectAll(".node")
      .data(this.treemap.nodes)
      .enter()
      .append("div")
      .attr("class", "node")
      .call(this._position)
      .style("background", function(d) {
        return d.children ? color(d.name) : null;
      })
      .attr('title', text)
      .text(text);
  },

  initBindings: function() {
    this.view.displayedWeightData.subscribe(
      this.update.bind(this)
    );
  },

  init: function() {
    this.initD3();
    this.initBindings();
  }
};

model.init();
view.init();
model.dataInitialized.subscribe(function(val) {
  if (val) { d3View.init(); }
});

ko.applyBindings(view);
