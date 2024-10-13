import React, { useContext, useState} from 'react';
import { AdminContext } from '../Context/AdminContext';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
    const { atoken,setAToken } = useContext(AdminContext);
    const navigate=useNavigate();

  const logout=()=>{
    navigate("/")
    atoken && setAToken(``)
    atoken && localStorage.removeItem(`aToken`)
  }
    return (
        <div className="bg-blue-600 p-4 flex justify-between items-center">
            <div>
                <h1 className="text-white text-2xl font-bold">Medscription Admin</h1>
                <p className="text-white text-lg">{atoken ? "Admin":"Doctor"}</p>
            </div>   
            <button onClick={logout} className="bg-white text-blue-600 px-4 py-2 rounded hover:bg-gray-200 transition">
                Logout
            </button>
        </div>
    );
}

export default Navbar;
