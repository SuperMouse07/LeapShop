# Navigation

导航栏的布局与功能在每一页都保持一致。

1. Leap LOGO 放在最左边。设计惯例。

2. 中间可跳转按钮，用于跳转到其他页面
	- Home（本页）
	- Product Overview
	- Chess Clock
	- Chess Board
	- Stopwatch
	- Chess Lifestyle
	- Our Journey

3. 购物车图标，点击会从右侧给出一个抽屉，会显示当前已经加入购物车的商品，包含缩略图、名称、数量（可修改）、单价、总价等信息，还可以选择移除物品。最下方有一个按钮，点击可以一键导出购物清单。（也即暂时不做支付功能，只导出信息）

---
---


# Home（Landing Page）

## Hero Section

用户搜索官网进来的首页就是这里。

最上方写着：One-stop comprehensive service provider for global sports clubs

中间轮播商品图片，图片在后台后台上传。商品图片的下方有按钮，用深浅不同的颜色表达，图片会自己轮播 8 秒，然后切换下一张，用户也可以自己点击切换。



紧挨着，下方做一个按钮“browse”，点击后会跳转到 product overview

---

## Why Choose Leap - Section

局部标题：Why Choose Leap

然后文本：32 years of experience in the sports industry, service network spanning 46 countries

接着居中文本，Supporting 500,000+ Chess Clubs Worldwide. 这个文本是有超链接的，点击会跳转到 Our Journey 页面

 
---

## Featured Products - Section

采用交错卡片布局，展示 4 种类型的产品，分别是 chess clock、chess board、stopwatch、chess lifestyle，每种类型的产品选取一个代表出来。

每张卡片都会有该系列的一个简单说明，下方还会有一个“Learn More”按钮，点击就会跳转到该系列。

接着给一个按钮“browse”，点击后会跳转到 product overview，查看更多产品。

> 注意：learn more 是跳转到具体的系列，browse 是跳转到 product overview 页面。


---

## Our Jounary - Section

这里给一个简单的介绍，标出一些数据，加载时会有增加，例如 32 年，会有动态的变化，从 0 加到 32 这样子。

下方再给一行文字，写 Discover more，点击会跳转到 Our Jounary 页面。


---


# Product Overview - (Page)
## Overview

从上到下依次展示Chess Clock、Chess Board、Stopwatch、Chess Lifestyle 相关的产品，每个类型的产品都有一个区块。产品的展示以瀑布流的方式呈现出来。

每种产品一个小标题。

点击产品的图片，可以跳转到具体产品的单页。这里展示的图片是主图，也即后台上传的第一张图片。
 
## Product dimensions & information

每个产品有单独的页面，左侧显示图片，右侧是产品价格与介绍，以及“add to cart”按钮，这样会加入到购物车，购物车抽屉的大小刚好和产品介绍页一样

图片分为两个部分，上方是可以左右滑动的主图，图片以 1:1 规格呈现。最多 10 张

下方是详情页，任意大小的图片都可以，上下紧密贴着，通过等比例缩放使得左右的间距保持一致。最多 20 张。

右方的介绍页，从上到下，依次展示：

区块 1：标题、价格、数量选择、add to cart。这里用 UI 设计。
区块 2：详细的文字介绍（product information）。这里用 markdown 语法。

---
---

# Our jounary - (Page)

这一页居中的文字介绍即可，先直接引用：

```
About Us

### Our Heritage: Two Decades of Mastery

The story of **LeapSport (leapsport.nl)** is not one that started yesterday. Our roots are deeply embedded in the legacy of **Leap Industrial Co., Ltd.** Since its founding in 2001, Leap has been a global pioneer in the field of professional sports timing and chess equipment.

For over 20 years, the "**LEAP**" brand has evolved from a specialized laboratory name into a household staple trusted by millions of chess players worldwide. From young students making their first moves to Grandmasters competing under the bright lights of international stages, LEAP timers have witnessed countless moments of strategic brilliance. This dedication to precision—down to the very last second—is the soul of every product we offer.

### Why Choose LeapSport?

At LeapSport, we do more than just sell equipment; we bridge the gap between world-class manufacturing and the individual needs of the modern player.

- **Deep R&D Foundation:** Backed by our parent company’s robust Research & Development center, we hold numerous patents in timing technology. Every clock and chessboard in our collection has undergone rigorous stress testing to ensure tournament-grade reliability.
    
- **Professional Excellence:** Our products are designed to meet the exacting standards of the chess community and are widely used in professional clubs and sanctioned tournaments globally.
    
- **Factory-Direct Assurance:** Owning our manufacturing facilities means we control quality from the raw material to the final package. It allows us to provide professional-grade gear at a value that intermediaries simply cannot match.
    

### Innovation: Redefining the 64 Squares

While we hold a deep respect for the traditions of the "Game of Kings," we refuse to be limited by them. With the launch of **leapsport.nl**, we have introduced our most ambitious project yet: **The 3D-Printed Portable Series.**

- **Technology-Driven Design:** We utilize cutting-edge 3D printing technology to reimagine the form and function of chess sets—making them lighter, more durable, and perfectly suited for a mobile lifestyle.
    
- **Personalized Expression:** This technology allows us to offer customization and unique designs that traditional mass-injection molding cannot achieve. We are making it possible for every player to own a set as unique as their own playing style.
    

### Our Global Commitment

While we are proudly rooted in our Dutch-facing platform (**leapsport.nl**), our vision is truly global. Today, our catalog features over 300 professional products, ranging from entry-level educational tools to collector-grade art pieces.

**Our mission is simple:** To ensure that every chess enthusiast, regardless of where they are in the world, has access to the equipment they need to master the game.

```

