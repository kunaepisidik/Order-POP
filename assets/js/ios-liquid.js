document.addEventListener("DOMContentLoaded",()=>{

const card=document.querySelector(".auth-card-ios");

document.addEventListener("mousemove",e=>{

if(window.innerWidth<901)return;

const x=(e.clientX/window.innerWidth-.5)*10;
const y=(e.clientY/window.innerHeight-.5)*8;

card.style.transform=`
rotateY(${x}deg)
rotateX(${-y}deg)
`;

});

document.addEventListener("mouseleave",()=>{

card.style.transform="rotateY(0deg) rotateX(0deg)";

});

const cards=document.querySelectorAll(".feature-card");

const observer=new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.animate([

{
opacity:0,
transform:"translateY(25px)"
},
{
opacity:1,
transform:"translateY(0)"
}

],{

duration:600,
easing:"cubic-bezier(.2,.8,.2,1)",
fill:"forwards"

});

observer.unobserve(entry.target);

}

});

},{
threshold:.15
});

cards.forEach(c=>observer.observe(c));

});
