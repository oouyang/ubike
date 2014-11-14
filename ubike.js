var sites;

function init() {
}
function crsdist(lat1,lon1,lat2,lon2){ // radian args
/* compute course and distance (spherical) */

if ((lat1+lat2==0.) && (Math.abs(lon1-lon2)==Math.PI)
                    && (Math.abs(lat1) != (Math.PI/180)*90.)){
    console.log("Course between antipodal points is undefined")
    }

with (Math){
  d=acos(sin(lat1)*sin(lat2)+cos(lat1)*cos(lat2)*cos(lon1-lon2))
}
out=new MakeArray(0)
out.d=d
return out
}
function distances(sites)
{
  var R = 6371; //km
  var g1;
  var t1;
  if (navigator && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (position) {
        lat = position.coords.latitude;
        lng = position.coords.longtitude;
        g1 = lat.toRadians();
        t1 = lng.toRadians();
        for (i in sites) {
          var dt = (sites[i].lat-lat).toRadians();
          var dg = (sites[i].lng-lng).toRadians();
          var a = Math.sin(dt/2) * Math.sin(dt/2) +
                  Math.cos(dt) * Math.cos(dg) *
                  Math.sin(dg/2) * Math.sin(dg
        }
      });
  }
  return sites;
}
