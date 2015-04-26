$name = 'choco android-tools-adb'
$installerType = 'exe'
$url  = 'http://cznic.dl.sourceforge.net/project/adbstandalone/adb_install.exe'
$silentArgs = ''

Install-ChocolateyPackage $name $installerType $silentArgs $url