import React, { useState } from 'react';
import { Icon } from '../utils/helpers'; // Icon은 helpers.js에서 Import

export default function LoginPage({ onLogin }) { 
    const [id, setId] = useState('employee');
    const [password, setPassword] = useState('academy');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        if (id === 'employee' && password === 'academy') {
            onLogin();
        } else {
            setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="w-full max-w-md">
                <form onSubmit={handleLogin} className="bg-white shadow-2xl rounded-xl px-8 pt-6 pb-8 mb-4">
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-extrabold text-blue-600 flex items-center justify-center">
                            <Icon name="graduationCap" className="w-8 h-8 mr-2" />
                            학원 관리 시스템
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">직원 로그인 페이지</p>
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
                            아이디 (employee)
                        </label>
                        <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-blue-500 focus:border-blue-500" 
                                id="username" type="text" placeholder="아이디" value={id} onChange={(e) => setId(e.target.value)} />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                            비밀번호 (academy)
                        </label>
                        <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:ring-blue-500 focus:border-blue-500" 
                                id="password" type="password" placeholder="******************" value={password} onChange={(e) => setPassword(e.target.value)} />
                        {error && <p className="text-red-500 text-xs italic">{error}</p>}
                    </div>
                    <div className="flex items-center justify-between">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-150 w-full shadow-md" type="submit">
                            로그인
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};