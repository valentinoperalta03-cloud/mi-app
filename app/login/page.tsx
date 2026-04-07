"use client";

import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");

  const handleLogin = () => {
    alert("Revisá tu email para iniciar sesión: " + email);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      {/* Título */}
      <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">
        Iniciar sesión
      </h1>
      
      <p className="text-center mb-6 text-lg text-gray-600">Volvé a la cancha</p>

      {/* Botón de Google */}
      <button className="w-full bg-blue-500 text-white py-2 rounded mb-4 hover:bg-blue-600">
        <span className="mr-2">🔵</span>
        Continuar con Google
      </button>

      {/* Separador */}
      <div className="my-4 flex justify-center items-center text-sm text-gray-500">
        <span className="border-t w-24"></span>
        <span className="mx-2">o con email</span>
        <span className="border-t w-24"></span>
      </div>

      {/* Input de correo */}
      <input
        type="email"
        placeholder="Correo electrónico"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 rounded mb-4 w-full"
      />

      {/* Input de contraseña */}
      <input
        type="password"
        placeholder="Contraseña"
        className="border p-2 rounded mb-4 w-full"
      />

      {/* Botón de login */}
      <button
        onClick={handleLogin}
        className="w-full bg-blue-500 text-white py-2 rounded mb-4 hover:bg-blue-600"
      >
        Entrar
      </button>

      {/* Link de registro */}
      <p className="text-center text-sm text-gray-600">
        ¿No tenés cuenta? <a href="#" className="text-blue-600">Registrate</a>
      </p>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-4">
        Al continuar, aceptas nuestras{" "}
        <a href="#" className="text-blue-600">Condiciones del Servicio</a> y{" "}
        <a href="#" className="text-blue-600">Política de Privacidad</a>.
      </p>
    </main>
  );
}
