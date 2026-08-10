/* ============================================================
   鼠图图 Shututu · 交互脚本
   - 滚动显现 / 数字滚动 / 导航交互 / 奶酪碎屑 / 跑轮彩蛋
   ============================================================ */

(function () {
  "use strict";

  /* ---------- 导航：滚动变色 + 移动端菜单 ---------- */
  var nav = document.getElementById("nav");
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  window.addEventListener("scroll", function () {
    nav.classList.toggle("scrolled", window.scrollY > 40);
  }, { passive: true });

  navToggle.addEventListener("click", function () {
    navLinks.classList.toggle("open");
  });

  navLinks.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      navLinks.classList.remove("open");
    });
  });

  /* ---------- 滚动显现 ---------- */
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".reveal").forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ---------- 数字滚动 ---------- */
  function animateCount(el) {
    var target = parseInt(el.dataset.target, 10) || 0;
    var suffix = el.dataset.suffix || "";
    var duration = 1600;
    var start = null;

    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = Math.floor(eased * target).toLocaleString("en-US") + (progress === 1 ? suffix : "");
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  var countObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll(".stat-num").forEach(function (el) {
    countObserver.observe(el);
  });

  /* ---------- 奶酪碎屑跟随鼠标 ---------- */
  var lastCrumb = 0;
  var CRUMB_INTERVAL = 90; // ms

  document.addEventListener("mousemove", function (e) {
    var now = Date.now();
    if (now - lastCrumb < CRUMB_INTERVAL) return;
    lastCrumb = now;

    var crumb = document.createElement("span");
    crumb.className = "cheese-crumb";
    crumb.textContent = Math.random() > 0.25 ? "🧀" : "🐭";
    crumb.style.left = e.clientX + (Math.random() * 16 - 8) + "px";
    crumb.style.top = e.clientY + 6 + "px";
    document.body.appendChild(crumb);

    setTimeout(function () {
      crumb.remove();
    }, 950);
  }, { passive: true });

  /* ---------- 跑轮彩蛋 ---------- */
  var wheel = document.getElementById("wheel");
  var wheelCount = document.getElementById("wheelCount");
  var squeak = document.getElementById("squeak");
  var spinning = false;
  var laps = 0;
  var spinTimer = null;

  var SQUEAKS = ["吱！", "吱吱~", "咔哒咔哒", "冲鸭！", "奶酪+1"];

  wheel.addEventListener("click", function () {
    spinning = !spinning;
    wheel.classList.toggle("spinning", spinning);

    if (spinning) {
      spinTimer = setInterval(function () {
        laps += 1;
        wheelCount.textContent = laps;
        if (laps % 10 === 0) {
          squeak.textContent = SQUEAKS[Math.floor(Math.random() * SQUEAKS.length)];
          setTimeout(function () { squeak.textContent = ""; }, 800);
        }
      }, 120);
    } else {
      clearInterval(spinTimer);
      spinTimer = null;
      squeak.textContent = "呼……休息一会";
      setTimeout(function () { squeak.textContent = ""; }, 1200);
    }
  });

  /* ---------- 页脚年份 ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
})();
