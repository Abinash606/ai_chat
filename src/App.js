import axios from "axios";
import './App.css'
import { useState } from "react";

function App() {
  const[question , setQuestion] = useState("");
  const[answer,SetAnswer] = useState("");

  async function generateAnswer(){
    SetAnswer("Loading ...");
    const apiKey = "AIzaSyCsMq6gG4s6BdYPOs7vB8peO7Q0A0BfxBo";
    const response = await axios({
      url:"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyCsMq6gG4s6BdYPOs7vB8peO7Q0A0BfxBo",
      method: "post",
      data:{
        "contents":[{"parts":[{"text":question}]}]},
    });
    
      SetAnswer(response['data']['candidates'][0]['content']['parts'][0]['text']);
  }


  return (
    <>
     <h1 className="">Chat AI</h1>
     <textarea  cols="30" rows="10" value={question}onChange={(e)=>setQuestion(e.target.value)} style={{ textAlign : "center "  }} className="text-area"></textarea>
     <div>
     <button onClick={generateAnswer}>Generate Answer</button>
     </div>
     <div>
     <textarea  cols="50" rows="20" value={answer} style={{ textAlign:"center"}} className="text-area"></textarea>
     </div>
    </>
  )
}

export default App
