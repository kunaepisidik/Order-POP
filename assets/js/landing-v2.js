document.addEventListener("DOMContentLoaded", () => {

const cards=document.querySelectorAll(".feature-card");

cards.forEach(card=>{
card.classList.add("reveal");
});

const observer=new IntersectionObserver(entries=>{
entries.forEach(entry=>{
if(entry.isIntersecting){
entry.target.classList.add("show");
}
});
},{
threshold:.15
});

cards.forEach(card=>observer.observe(card));

const buttons=document.querySelectorAll(".btn-modern");

buttons.forEach(btn=>{

btn.addEventListener("mousemove",e=>{

const rect=btn.getBoundingClientRect();

const x=e.clientX-rect.left;
const y=e.clientY-rect.top;

btn.style.setProperty("--x",`${x}px`);
btn.style.setProperty("--y",`${y}px`);

});

});

});
