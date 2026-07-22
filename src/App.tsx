import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby-iJ9kVeL1reGj00-I7JmWthdJmMQyf0GGx6ANswuOgvARbOs2n2ZAMGMgRQBAwKjNzg/exec";

type ScannerState = "idle" | "scanning" | "error";
type TipoEvento = "entrada" | "salida" | null;

function App() {
  const [state, setState] = useState<ScannerState>("idle");
  const [tipoEvento, setTipoEvento] = useState<TipoEvento>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [scannedResult, setScannedResult] = useState("");
  const [sendStatus, setSendStatus] = useState<
    "idle" | "sending" | "sent" | "error" | "rejected"
  >("idle");
  const [serverMessage, setServerMessage] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current.clear();
      scannerRef.current = null;
    }
  };

  const sendToSheet = async (qrId: string, evento: TipoEvento) => {
    setSendStatus("sending");
    setServerMessage("");
    try {
      const url = `${APPS_SCRIPT_URL}?qrId=${encodeURIComponent(qrId)}&tipoEvento=${encodeURIComponent(evento!)}`;
      const res = await fetch(url);
      const text = await res.text();
      console.log("Respuesta Apps Script:", res.status, text);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      let data: { ok: boolean; message?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Respuesta inválida del servidor");
      }

      if (data.ok) {
        setSendStatus("sent");
      } else {
        setSendStatus("rejected");
        setServerMessage(data.message || "Fichaje no permitido");
      }
    } catch (err) {
      setSendStatus("error");
      setServerMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const selectTipo = (tipo: TipoEvento) => {
    setTipoEvento(tipo);
    setScannedResult("");
    setSendStatus("idle");
    setServerMessage("");
  };

  const startScanning = async () => {
    try {
      setErrorMsg("");
      setScannedResult("");
      setSendStatus("idle");
      setServerMessage("");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: { exact: "user" } },
        { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1.0 },
        async (decodedText) => {
          console.log("QR detectado:", decodedText);
          setScannedResult(decodedText);
          await stopScanner();
          setState("idle");
          sendToSheet(decodedText, tipoEvento);
        },
        () => {}
      );

      setState("scanning");
    } catch (err) {
      setState("error");
      setErrorMsg(
        err instanceof Error ? err.message : "No se pudo acceder a la cámara"
      );
    }
  };

  const resetAll = async () => {
    await stopScanner();
    setState("idle");
    setTipoEvento(null);
    setScannedResult("");
    setSendStatus("idle");
    setServerMessage("");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-bold mb-6">Fichaje QR</h1>

      <div className="w-full max-w-sm">
        <div
          id="qr-reader"
          className="w-full rounded-xl overflow-hidden bg-gray-900 border border-gray-800"
        />

        {state === "error" && (
          <p className="mt-3 text-red-400 text-sm text-center">{errorMsg}</p>
        )}

        {state === "idle" && !scannedResult && (
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => selectTipo("entrada")}
              className={`flex-1 font-bold py-4 px-4 rounded-xl text-lg transition-all cursor-pointer ${
                tipoEvento === "entrada"
                  ? "bg-green-600 text-white ring-2 ring-green-400"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Entrada
            </button>
            <button
              onClick={() => selectTipo("salida")}
              className={`flex-1 font-bold py-4 px-4 rounded-xl text-lg transition-all cursor-pointer ${
                tipoEvento === "salida"
                  ? "bg-red-600 text-white ring-2 ring-red-400"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Salida
            </button>
          </div>
        )}

        {tipoEvento && state !== "scanning" && !scannedResult && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={startScanning}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors cursor-pointer text-lg"
            >
              Escanear QR
            </button>
          </div>
        )}

        {state === "scanning" && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-green-400 text-sm text-center">
              Escaneando... apunta la cámara al código QR
            </p>
            <p className="text-gray-500 text-xs">
              Tipo:{" "}
              <span
                className={
                  tipoEvento === "entrada"
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {tipoEvento === "entrada" ? "Entrada" : "Salida"}
              </span>
            </p>
            <button
              onClick={async () => {
                await stopScanner();
                setState("idle");
              }}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        )}

        {scannedResult && (
          <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs font-bold px-2 py-1 rounded ${
                  tipoEvento === "entrada"
                    ? "bg-green-900 text-green-300"
                    : "bg-red-900 text-red-300"
                }`}
              >
                {tipoEvento === "entrada" ? "ENTRADA" : "SALIDA"}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-1">Operario:</p>
            <p className="text-green-400 text-sm break-all font-mono">
              {scannedResult}
            </p>
            {sendStatus === "sending" && (
              <p className="mt-2 text-yellow-400 text-xs">
                Registrando fichaje...
              </p>
            )}
            {sendStatus === "sent" && (
              <p className="mt-2 text-green-400 text-xs font-medium">
                Fichaje registrado correctamente
              </p>
            )}
            {sendStatus === "rejected" && (
              <div className="mt-2 p-2 bg-yellow-950 border border-yellow-800 rounded-lg">
                <p className="text-yellow-400 text-xs font-medium">
                  Fichaje no permitido:
                </p>
                <p className="text-yellow-300 text-xs mt-1">
                  {serverMessage}
                </p>
              </div>
            )}
            {sendStatus === "error" && (
              <div className="mt-2 p-2 bg-red-950 border border-red-800 rounded-lg">
                <p className="text-red-400 text-xs font-medium">
                  Error al registrar:
                </p>
                <p className="text-red-300 text-xs break-all mt-1">
                  {serverMessage}
                </p>
              </div>
            )}
            <button
              onClick={resetAll}
              className="mt-3 w-full text-center bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2 rounded-lg transition-colors cursor-pointer"
            >
              Nuevo fichaje
            </button>
          </div>
        )}
      </div>
      <span className="mt-6 text-gray-600 text-xs">version 0.1.4</span>
    </div>
  );
}

export default App;
