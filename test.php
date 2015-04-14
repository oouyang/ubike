<?
$str = file_get_contents('http://i.youbike.com.tw/en/index.php');
$start = strpos($str, '000-11') + 7;
$start = strpos($str, '\'', $start);
$end = strpos($str, '\'', $start + 1);
$str = substr($str, $start+1, $end - $start - 1);
print_r(urldecode($str));
?>