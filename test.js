fetch('https://spreetrial.vercel.app/').then(r=>r.text()).then(t => { 
  console.log("Has render url?", t.includes('onrender.com')); 
  console.log("Has localhost 5002?", t.includes('localhost:5002')); 
  console.log("Has localhost 5001?", t.includes('localhost:5001')); 
})
