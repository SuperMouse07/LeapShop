# LeapChess API 全流程冒烟测试
$base = "http://localhost:3000/api"
$ErrorActionPreference = "Stop"

function Req($method, $path, $body = $null, $token = $null) {
  $headers = @{}
  if ($token) { $headers["Authorization"] = "Bearer $token" }
  $params = @{ Uri = "$base$path"; Method = $method; Headers = $headers }
  if ($body) {
    $params["Body"] = ($body | ConvertTo-Json -Depth 5)
    $params["ContentType"] = "application/json"
  }
  try {
    $r = Invoke-RestMethod @params
    return @{ ok = $true; data = $r; status = 200 }
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    $msg = ""
    if ($_.ErrorDetails.Message) {
      try { $msg = ($_.ErrorDetails.Message | ConvertFrom-Json).error } catch { $msg = $_.ErrorDetails.Message }
    }
    return @{ ok = $false; status = $code; msg = $msg }
  }
}

$pass = 0; $fail = 0
function Check($name, $cond, $extra = "") {
  if ($cond) { Write-Host "[PASS] $name $extra" -ForegroundColor Green; $script:pass++ }
  else { Write-Host "[FAIL] $name $extra" -ForegroundColor Red; $script:fail++ }
}

# 1. 健康检查
$h = Req "GET" "/health"
Check "健康检查" ($h.ok -and $h.data.status -eq "ok") "db=$($h.data.db)"

# 2. 商品列表（公开）
$l = Req "GET" "/products"
Check "公开商品列表" ($l.ok -and $l.data.products.Count -ge 10) "共 $($l.data.products.Count) 条"

# 3. 管理员登录
$adm = Req "POST" "/auth/login" @{ username = "P001"; password = "123456" }
Check "管理员登录 P001" ($adm.ok -and $adm.data.user.role -eq "admin")
$admToken = $adm.data.token

# 4. 客户登录
$cus = Req "POST" "/auth/login" @{ username = "C001"; password = "123456" }
Check "客户登录 C001" ($cus.ok -and $cus.data.user.role -eq "customer")
$cusToken = $cus.data.token

# 5. 错误密码
$bad = Req "POST" "/auth/login" @{ username = "P001"; password = "wrong" }
Check "错误密码拒绝" (-not $bad.ok -and $bad.status -eq 401)

# 6. /auth/me
$me = Req "GET" "/auth/me" $null $admToken
Check "Token 身份校验" ($me.ok -and $me.data.user.username -eq "P001")

# 7. 客户无写权限
$deny = Req "POST" "/products" @{ name = "test" } $cusToken
Check "客户写操作 403" (-not $deny.ok -and $deny.status -eq 403)

# 8. 未登录写操作
$nolog = Req "POST" "/products" @{ name = "test" }
Check "未登录写操作 401" (-not $nolog.ok -and $nolog.status -eq 401)

# 9. 管理员新增商品（Create）
$create = Req "POST" "/products" @{ name = "测试棋钟 QA-1"; category = "chess-timer"; price = 99.5; stock = 8; description = "自动化测试商品" } $admToken
Check "管理员新增商品" ($create.ok -and $create.data.product.name -eq "测试棋钟 QA-1") "id=$($create.data.product.id)"
$newId = $create.data.product.id

# 10. 更新商品（Update）
$upd = Req "PUT" "/products/$newId" @{ price = 88.0; stock = 10 } $admToken
Check "更新商品" ($upd.ok -and [double]$upd.data.product.price -eq 88.0)

# 11. 详情（Read）
$one = Req "GET" "/products/$newId"
Check "商品详情" ($one.ok -and $one.data.product.stock -eq 10)

# 12. 删除商品（Delete）
$del = Req "DELETE" "/products/$newId" $null $admToken
Check "删除商品" ($del.ok -and $del.data.ok)

# 13. 删除后 404
$gone = Req "GET" "/products/$newId"
Check "删除后 404" (-not $gone.ok -and $gone.status -eq 404)

# 14. 客户不可删除
$create2 = Req "POST" "/products" @{ name = "临时商品" } $admToken
$cusDel = Req "DELETE" "/products/$($create2.data.product.id)" $null $cusToken
Check "客户删除 403" (-not $cusDel.ok -and $cusDel.status -eq 403)
$null = Req "DELETE" "/products/$($create2.data.product.id)" $null $admToken

# 15. 静态页面托管
$home200 = (Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing).StatusCode
$login200 = (Invoke-WebRequest -Uri "http://localhost:3000/login.html" -UseBasicParsing).StatusCode
$admin200 = (Invoke-WebRequest -Uri "http://localhost:3000/admin.html" -UseBasicParsing).StatusCode
Check "静态托管 index/login/admin" ($home200 -eq 200 -and $login200 -eq 200 -and $admin200 -eq 200)

Write-Host "`n==== 结果: $pass 通过 / $fail 失败 ===="
exit $fail
