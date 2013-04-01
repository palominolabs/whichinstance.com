$(document).ready(function() {
    'use strict';
    var currency = 'USD',
        platform = 'linux',
        onDemandData = null,
        reservedData = {'heavy': null, 'medium': null, 'light': null},
        chart = new Highcharts.Chart({
            chart:       {
                renderTo: 'chart',
                type:     'line'
            },
            title:       {
                text: 'Instance cost'
            },
            xAxis:       {
                title: {
                    text: 'Days'
                }
            },
            yAxis:       {
                min: 0,
                title: {
                    text: 'Cost ($)'
                }
            },
            plotOptions: {
                series: {
                    marker: {
                        enabled: false
                    }
                }
            },
            tooltip:     {
                crosshairs: [true, true],
                formatter:  function() {
                    return this.series.name + '<br />Days: ' + this.x + '<br />Cost: $' + this.y.toFixed(2);
                }
            }
        }),
        regionCodeConfig = {
            'onDemand': {
                'us-east':    'us-east',
                'us-west':    'us-west',
                'us-west-2':  'us-west-2',
                'eu-ireland': 'eu-ireland',
                'apac-sin':   'apac-sin',
                'apac-tokyo': 'apac-tokyo',
                'apac-syd':   'apac-syd',
                'sa-east-1':  'sa-east-1'
            },
            'reserved': {
                'us-east':    'us-east',
                'us-west':    'us-west-1',
                'us-west-2':  'us-west-2',
                'eu-ireland': 'eu-west-1',
                'apac-sin':   'ap-southeast-1',
                'apac-tokyo': 'ap-northeast-1',
                'apac-syd':   'ap-southeast-2',
                'sa-east-1':  'sa-east-1'
            }
        },
        insTypeCodeConfig = {
            'onDemand': {
                'micro':               'uODI',
                'std':                 'stdODI',
                'std2':                'secgenstdODI',
                'hiMem':               'hiMemODI',
                'hiCpu':               'hiCPUODI',
                'clusterCompute':      'clusterComputeI',
                'hiMemClusterCompute': 'clusterHiMemODI',
                'clusterGpu':          'clusterGPUI',
                'hiIo':                'hiIoODI',
                'hiStorage':           'hiStoreODI'
            },
            'reserved': {
                'micro':               'uResI',
                'std':                 'stdResI',
                'std2':                'secgenstdResI',
                'hiMem':               'hiMemResI',
                'hiCpu':               'hiCPUResI',
                'clusterCompute':      'clusterCompResI',
                'hiMemClusterCompute': 'clusterHiMemResI',
                'clusterGpu':          'clusterGPUResI',
                'hiIo':                'hiIoResI',
                'hiStorage':           'hiStoreResI'
            }
        },
        seriesData = [],
        pricePerHour,
        getRegionCode = function(onDemandOrInstance) {
            return regionCodeConfig[onDemandOrInstance][$('#region').find(':selected').val()];
        },
        getInstanceType = function(onDemandOrInstance) {
            return insTypeCodeConfig[onDemandOrInstance][$('#insType').find(':selected').val()];
        },
        getInstanceSize = function() {
            return $('#insSize').find(':selected').val();
        },
        instanceFoundSomewhere = false,
        daysToShow = 365,
        utilizationFraction = 1.0,
        updateOnDemandData = function() {

            if (onDemandData == null) {
                console.log('on demand data not loaded');
                return;
            }

            var regionCode = getRegionCode('onDemand'),
                insTypeCode = getInstanceType('onDemand'),
                sizeCode = getInstanceSize();

            $.each(onDemandData.config.regions, function(i, region) {
                if (region.region != regionCode) {
                    return true;
                }
                $.each(region.instanceTypes, function(j, insType) {
                    if (insType.type != insTypeCode) {
                        return true;

                    }
                    $.each(insType.sizes, function(k, size) {

                        if (size.size != sizeCode) {
                            return true;
                        }

                        $.each(size.valueColumns, function(l, sizeValue) {
                            if (sizeValue.name != platform) {
                                return true;
                            }

                            instanceFoundSomewhere = true;

                            pricePerHour = sizeValue.prices[currency];
                            seriesData.length = 0;
                            for (var d = 0; d < daysToShow; d++) {
                                seriesData.push(d * pricePerHour * 24 * utilizationFraction);
                            }

                            chart.addSeries({
                                data: seriesData,
                                name: "on demand"
                            });

                            return false;
                        });

                        return false;
                    });

                    return false;
                });

                return false;
            });
        },
        updateReservedData = function(utilization, includeHourlyCostIncrementally) {
            if (reservedData[utilization] == null) {
                console.log('reserved ' + utilization + ' not loaded');
                return;
            }

            var regionCode = getRegionCode('reserved'),
                insTypeCode = getInstanceType('reserved'),
                sizeCode = getInstanceSize();

            $.each(reservedData[utilization].config.regions, function(_, region) {
                if (region.region != regionCode) {
                    return true;
                }

                $.each(region.instanceTypes, function(_, type) {
                    if (type.type != insTypeCode) {
                        return true;
                    }

                    $.each(type.sizes, function(_, size) {
                        if (size.size != sizeCode) {
                            return true;
                        }

                        var priceData = {},
                            d,
                            f,
                            termLength;

                        // assemble a map of the various value columns
                        $.each(size.valueColumns, function(_, priceSpec) {
                            f = parseFloat(priceSpec.prices[currency]);
                            if (isNaN(f)) {
                                priceData[priceSpec.name] = null;
                            } else {
                                priceData[priceSpec.name] = f;
                            }
                        });

                        instanceFoundSomewhere = true;

                        // if 1 yr data was available, use it
                        if (priceData.yrTerm1 != null && priceData.yrTerm1Hourly != null) {
                            seriesData.length = 0;
                            pricePerHour = priceData.yrTerm1Hourly;
                            termLength = 365;
                            for (d = 0; d < daysToShow; d++) {
                                if (includeHourlyCostIncrementally) {
                                    seriesData.push(priceData.yrTerm1 * (1 + Math.floor(d / termLength)) + d * pricePerHour * 24 * utilizationFraction);
                                } else {
                                    seriesData.push(priceData.yrTerm1 * (1 + Math.floor(d / termLength)) + termLength * pricePerHour * 24);
                                }
                            }
                            chart.addSeries({
                                data: seriesData,
                                name: "1 yr " + utilization
                            });
                        }

                        // if 3 yr data was avilable, use it
                        if (priceData.yrTerm3 != null && priceData.yrTerm3Hourly != null) {
                            // 3 yr
                            seriesData.length = 0;
                            pricePerHour = priceData.yrTerm3Hourly;
                            termLength = 365 * 3;
                            for (d = 0; d < daysToShow; d++) {
                                if (includeHourlyCostIncrementally) {
                                    seriesData.push(priceData.yrTerm3 * (1 + Math.floor(d / termLength)) + d * pricePerHour * 24 * utilizationFraction);
                                } else {
                                    seriesData.push(priceData.yrTerm3 * (1 + Math.floor(d / termLength)) + termLength * pricePerHour * 24);
                                }
                            }

                            chart.addSeries({
                                data: seriesData,
                                name: "3 yr " + utilization
                            });
                        }

                        return false;
                    });

                    return false;
                });

                return false;
            })
        },
        onChange = function() {

            $('#spinner').show();

            window.setTimeout(function() {
                // clear the chart

                while (chart.series.length > 0) {
                    chart.series[0].remove();
                }

                instanceFoundSomewhere = false;

                daysToShow = parseInt($('#days').val());
                utilizationFraction = parseFloat($('#utilization').val()) / 100.0;

                updateOnDemandData();
                $.each(['medium', 'light'], function(_, obj) {
                    updateReservedData(obj, true);
                });
                updateReservedData('heavy', false);

                if (!instanceFoundSomewhere) {
                    var msg = "It doesn't appear that <strong>" + $('#region').find(':selected').text() + '</strong> has instance type <strong>' +
                        $('#insType').find(':selected').text() + '</strong> in size <strong>' + $('#insSize').find(':selected').text() + '</strong>. '
                        + 'Use <a href="https://aws.amazon.com/ec2/instance-types/">this page</a> for reference.';
                    $('#message').html(msg);
                } else {
                    $('#message').text('');
                }

                setTitle();

                $('#spinner').hide();
            }, 0);

        },
        setTitle = function() {
            var title = $('#region').find(':selected').text() + ': ' + $('#insType').find(':selected').text() + '/' +
                $('#insSize').find(':selected').text();
            chart.setTitle({text: title});
        };

    $.each(['#region', '#insType', '#insSize', '#days', '#utilization'], function(_, obj) {
        $(obj).change(onChange);
    });

    $.getJSON('/js/pricing-on-demand-instances.json',
        function(data) {
            onDemandData = data;

            updateOnDemandData();
        });

    $.each(['medium', 'light'], function(_, obj) {
        $.getJSON('/js/ri-' + obj + '-linux.json',
            function(data) {
                reservedData[obj] = data;

                updateReservedData(obj, true);
            });
    });

    $.each(['heavy'], function(_, obj) {
        $.getJSON('/js/ri-' + obj + '-linux.json',
            function(data) {
                reservedData[obj] = data;

                updateReservedData(obj, false);
            });
    });

    setTitle();

});
