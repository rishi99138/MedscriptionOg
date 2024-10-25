import { createContext, useState } from "react";

export const DoctorContext=createContext();

const DoctorContextProvider=(props)=>{
    const backendUrl=import.meta.env.VITE_BACKEND_URL
const [dtoken,setDToken]=useState(localStorage.getItem('dToken')?localStorage.getItem('dToken'):"")
const value={
dtoken,setDToken,backendUrl,
}

return (
    <DoctorContext.Provider value={value}>
        {props.children}
    </DoctorContext.Provider>
)
}
export default DoctorContextProvider;