
// parse_ = function(data) {
//   var stores = [];
//   for (var i = 0, row; row = data.features[i]; i++) {
//     var props = row.properties;
//     var features = new storeLocator.FeatureSet;
//     features.add(this.FEATURES_.getById('Wheelchair-' + props.Wheelchair));
//     features.add(this.FEATURES_.getById('Audio-' + props.Audio));

//     var position = new google.maps.LatLng(row.geometry.coordinates[1],
//                                           row.geometry.coordinates[0]);

//     var shop = this.join_([props.Shp_num_an, props.Shp_centre], ', ');
//     var locality = this.join_([props.Locality, props.Postcode], ', ');

//     var store = new storeLocator.Store(props.uuid, position, features, {
//       title: props.Fcilty_nam,
//       address: this.join_([shop, props.Street_add, locality], '<br>'),
//       hours: props.Hrs_of_bus
//     });
//     stores.push(store);
//   }
//   return stores;
// };

