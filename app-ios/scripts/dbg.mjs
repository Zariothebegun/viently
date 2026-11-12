import { readFileSync, writeFileSync } from "node:fs";
let h = readFileSync(".preview/cell.html", "utf8");
const dbg = `<script>
setTimeout(function(){
  var out=[];
  document.querySelectorAll("#labels .pill").forEach(function(el){
    var r=el.getBoundingClientRect();
    out.push(Math.round(r.left)+"-"+Math.round(r.right)+" w"+el.offsetWidth);
  });
  document.title = "DBG " + window.innerWidth + "x" + window.innerHeight + " | " + out.join(" | ");
}, 5000);
</script>`;
h = h.replace("</body>", dbg + "</body>");
writeFileSync(".preview/dbg-cell.html", h);
console.log("ok");
