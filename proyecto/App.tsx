
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";

import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";

const API_URL = "http://52.1.172.32:8081/predict/";

type Huevo = {
  huevo: number;
  clasificacion: string;
  confianza: number;
  box: number[];
};

type Resultado = {
  archivo: string;
  total_huevos: number;
  huevos_buenos: number;
  huevos_rotos: number;
  huevos: Huevo[];
};

type Pantalla = "inicio" | "camara" | "resultado";

export default function App() {

  const [pantalla, setPantalla] =
    useState<Pantalla>("inicio");

  const [imagen, setImagen] =
    useState<string | null>(null);

  const [resultado, setResultado] =
    useState<Resultado | null>(null);

  const [cargando, setCargando] =
    useState(false);

  const [detectando, setDetectando] =
    useState(false);

  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();

  const cameraRef =
    useRef<CameraView | null>(null);

  const procesandoAutomatico =
    useRef(false);

  const intervaloRef =
    useRef<ReturnType<typeof setInterval> | null>(null);


  // ==========================================================
  // ABRIR CÁMARA
  // ==========================================================

  const abrirCamara = async () => {

    if (!cameraPermission?.granted) {

      const permiso =
        await requestCameraPermission();

      if (!permiso.granted) {

        Alert.alert(
          "Permiso necesario",
          "Debes permitir el acceso a la cámara."
        );

        return;
      }
    }

    setImagen(null);
    setResultado(null);

    setPantalla("camara");
  };


  // ==========================================================
  // GALERÍA
  // ==========================================================

  const seleccionarImagen = async () => {

    try {

      const permiso =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permiso.granted) {

        Alert.alert(
          "Permiso necesario",
          "Debes permitir el acceso a la galería."
        );

        return;
      }

      const seleccion =
        await ImagePicker.launchImageLibraryAsync({

          mediaTypes: ["images"],

          allowsEditing: false,

          quality: 1,
        });

      if (seleccion.canceled) {
        return;
      }

      const uri =
        seleccion.assets[0].uri;

      setImagen(uri);
      setResultado(null);
      setPantalla("resultado");

      await analizarImagen(uri);

    } catch (error) {

      console.error(error);

      Alert.alert(
        "Error",
        "No fue posible seleccionar la imagen."
      );
    }
  };


  // ==========================================================
  // TOMAR FOTO MANUAL
  // ==========================================================

  const tomarFoto = async () => {

    if (!cameraRef.current || cargando) {
      return;
    }

    try {

      setCargando(true);
      setDetectando(false);

      detenerDeteccionAutomatica();

      const foto =
        await cameraRef.current.takePictureAsync({
          quality: 1,
          skipProcessing: false,
        });

      if (!foto?.uri) {

        throw new Error(
          "No se obtuvo la fotografía."
        );
      }

      console.log(
        "📸 FOTO MANUAL:",
        foto.uri
      );

      setImagen(foto.uri);

      setPantalla("resultado");

      await analizarImagen(foto.uri);

    } catch (error) {

      console.error(
        "ERROR FOTO MANUAL:",
        error
      );

      Alert.alert(
        "Error",
        "No fue posible tomar la fotografía."
      );

      setCargando(false);
    }
  };


  // ==========================================================
  // DETECCIÓN AUTOMÁTICA
  // ==========================================================

  const revisarCamaraAutomaticamente =
    async () => {

      if (!cameraRef.current) {
        return;
      }

      if (procesandoAutomatico.current) {
        return;
      }

      if (cargando) {
        return;
      }

      procesandoAutomatico.current = true;

      try {

        console.log(
          "📷 Capturando imagen para detección..."
        );

        const foto =
          await cameraRef.current.takePictureAsync({

            quality: 0.6,

            skipProcessing: true,
          });

        if (!foto?.uri) {
          return;
        }

        const archivo =
          new File(foto.uri);

        console.log(
          "📦 Archivo preparado:",
          archivo.uri
        );

        const formData =
          new FormData();

        formData.append(
          "file",
          archivo as any
        );

        console.log(
          "☁️ Enviando imagen a AWS..."
        );

        const response =
          await fetch(API_URL, {

            method: "POST",

            body: formData,
          });

        if (!response.ok) {

          throw new Error(
            `Servidor respondió ${response.status}`
          );
        }

        const data: Resultado =
          await response.json();

        console.log(
          "🤖 RESPUESTA AUTOMÁTICA:",
          JSON.stringify(data, null, 2)
        );


        // ====================================================
        // SI DETECTÓ UN HUEVO
        // ====================================================

        if (data.total_huevos > 0) {

          console.log(
            "🥚 HUEVO DETECTADO AUTOMÁTICAMENTE"
          );

          detenerDeteccionAutomatica();

          setImagen(foto.uri);

          setResultado(data);

          setDetectando(false);

          setPantalla("resultado");
        }

      } catch (error) {

        console.log(
          "❌ Error durante detección automática:",
          error
        );

      } finally {

        procesandoAutomatico.current =
          false;
      }
    };


  // ==========================================================
  // INICIAR DETECCIÓN AUTOMÁTICA
  // ==========================================================

  const iniciarDeteccionAutomatica = () => {

    if (intervaloRef.current) {
      return;
    }

    console.log(
      "🤖 Iniciando detección automática..."
    );

    setDetectando(true);

    revisarCamaraAutomaticamente();

    intervaloRef.current =
      setInterval(() => {

        revisarCamaraAutomaticamente();

      }, 1200);
  };


  // ==========================================================
  // DETENER DETECCIÓN
  // ==========================================================

  const detenerDeteccionAutomatica = () => {

    if (intervaloRef.current) {

      clearInterval(
        intervaloRef.current
      );

      intervaloRef.current = null;
    }

    setDetectando(false);
  };


  // ==========================================================
  // CUANDO ENTRA A LA CÁMARA
  // ==========================================================

  useEffect(() => {

    if (pantalla === "camara") {

      const timer =
        setTimeout(() => {

          iniciarDeteccionAutomatica();

        }, 1000);

      return () => {

        clearTimeout(timer);
      };
    }

    detenerDeteccionAutomatica();

    return undefined;

  }, [pantalla]);


  // ==========================================================
  // LIMPIAR AL CERRAR
  // ==========================================================

  useEffect(() => {

    return () => {

      detenerDeteccionAutomatica();
    };

  }, []);


  // ==========================================================
  // ANALIZAR IMAGEN
  // ==========================================================

  const analizarImagen =
    async (uri: string) => {

      setCargando(true);

      try {

        const archivo =
          new File(uri);

        const nombreArchivo =
          archivo.name || "huevo.jpg";

        const formData =
          new FormData();

        formData.append(
          "file",
          archivo as any
        );

        console.log(
          "☁️ Enviando imagen manual a AWS..."
        );

        const response =
          await fetch(API_URL, {

            method: "POST",

            body: formData,
          });

        if (!response.ok) {

          throw new Error(
            `Error del servidor: ${response.status}`
          );
        }

        const data: Resultado =
          await response.json();

        console.log(
          "RESPUESTA API:",
          JSON.stringify(data, null, 2)
        );

        setResultado(data);

      } catch (error) {

        console.error(
          "ERROR:",
          error
        );

        Alert.alert(
          "Error de conexión",
          "No fue posible comunicarse con el servidor de AWS."
        );

      } finally {

        setCargando(false);
      }
    };


  // ==========================================================
  // VOLVER A CÁMARA
  // ==========================================================

  const volverACamara = () => {

    setImagen(null);

    setResultado(null);

    setCargando(false);

    setPantalla("camara");
  };


  // ==========================================================
  // PANTALLA INICIAL
  // ==========================================================

  if (pantalla === "inicio") {

    return (

      <SafeAreaView
        style={styles.container}
      >

        <View style={styles.inicio}>

          <Text style={styles.iconoPrincipal}>
            🥚
          </Text>

          <Text style={styles.titulo}>
            Detector de Huevos
          </Text>

          <Text style={styles.subtitulo}>
            Detecta automáticamente si un huevo
            está bueno o roto
          </Text>


          <TouchableOpacity
            style={styles.botonPrincipal}
            onPress={abrirCamara}
          >

            <Text
              style={styles.textoBotonPrincipal}
            >
              📷 Abrir cámara
            </Text>

          </TouchableOpacity>


          <TouchableOpacity
            style={styles.botonSecundario}
            onPress={seleccionarImagen}
          >

            <Text
              style={styles.textoBotonSecundario}
            >
              🖼️ Seleccionar imagen
            </Text>

          </TouchableOpacity>

        </View>

      </SafeAreaView>
    );
  }


  // ==========================================================
  // PANTALLA DE CÁMARA
  // ==========================================================

  if (pantalla === "camara") {

    return (

      <SafeAreaView
        style={styles.cameraContainer}
      >

        {/* ==================================================
            CÁMARA
        ================================================== */}

<View style={styles.cameraWrapper}>
  <CameraView
    ref={cameraRef}
    style={styles.camera}
    facing="back"
  />

  <View
    style={styles.cameraOverlay}
    pointerEvents="box-none"
  >
    {/* aquí permanecen el recuadro,
        texto y botón */}
  </View>
</View>


        {/* ==================================================
            CONTROLES ENCIMA DE LA CÁMARA
        ================================================== */}

        <View
          style={styles.cameraOverlay}
          pointerEvents="box-none"
        >

          {/* INDICADOR */}

          <View style={styles.indicador}>

            <View
              style={
                detectando
                  ? styles.puntoActivo
                  : styles.punto
              }
            />

            <Text
              style={styles.textoIndicador}
            >
              {detectando
                ? "Buscando huevo..."
                : "Cámara activa"}
            </Text>

          </View>


          {/* RECUADRO */}

          <View
            style={styles.areaDeteccion}
          >

            <View style={styles.esquina1} />
            <View style={styles.esquina2} />
            <View style={styles.esquina3} />
            <View style={styles.esquina4} />

          </View>


          {/* MENSAJE */}

          <View
            style={styles.instrucciones}
          >

            <Text
              style={styles.instruccion}
            >
              Coloca el huevo dentro del recuadro
            </Text>

            <Text
              style={styles.textoAutomatico}
            >
              La foto se tomará automáticamente
              al detectar un huevo
            </Text>

          </View>


          {/* BOTÓN MANUAL */}

          <TouchableOpacity
            style={styles.botonCamara}
            onPress={tomarFoto}
            disabled={cargando}
            activeOpacity={0.8}
          >

            <View
              style={styles.circuloCamara}
            >

              <View
                style={styles.circuloInterior}
              />

            </View>

            <Text
              style={styles.textoTomar}
            >
              Tomar foto
            </Text>

          </TouchableOpacity>

        </View>

      </SafeAreaView>
    );
  }


  // ==========================================================
  // RESULTADO
  // ==========================================================

  return (

    <SafeAreaView
      style={styles.container}
    >

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        <Text
          style={styles.tituloResultado}
        >
          Resultado
        </Text>


        {imagen && (

          <View
            style={styles.imagenContainer}
          >

            <Image
              source={{ uri: imagen }}
              style={styles.imagen}
              resizeMode="contain"
            />

          </View>
        )}


        {cargando && (

          <View
            style={styles.cargando}
          >

            <ActivityIndicator
              size="large"
            />

            <Text
              style={styles.textoCargando}
            >
              Analizando huevo...
            </Text>

          </View>
        )}


        {resultado && !cargando && (

          <View>

            {/* RESUMEN */}

            <View style={styles.resumen}>

              <View style={styles.tarjeta}>

                <Text style={styles.numero}>
                  {resultado.total_huevos}
                </Text>

                <Text style={styles.etiqueta}>
                  Huevos
                </Text>

              </View>


              <View style={styles.tarjeta}>

                <Text
                  style={styles.numeroBueno}
                >
                  {resultado.huevos_buenos}
                </Text>

                <Text style={styles.etiqueta}>
                  Buenos
                </Text>

              </View>


              <View style={styles.tarjeta}>

                <Text
                  style={styles.numeroRoto}
                >
                  {resultado.huevos_rotos}
                </Text>

                <Text style={styles.etiqueta}>
                  Rotos
                </Text>

              </View>

            </View>


            {/* HUEVOS */}

            {resultado.huevos.map(
              (huevo) => {

                const esBueno =
                  huevo.clasificacion ===
                  "BUENO";

                return (

                  <View
                    key={huevo.huevo}
                    style={styles.huevoResultado}
                  >

                    <Text
                      style={styles.huevoTitulo}
                    >
                      Huevo {huevo.huevo}
                    </Text>


                    <Text
                      style={
                        esBueno
                          ? styles.bueno
                          : styles.roto
                      }
                    >
                      {esBueno
                        ? "✓ BUENO"
                        : "✕ ROTO"}
                    </Text>


                    <Text
                      style={styles.confianza}
                    >
                      Confianza:{" "}
                      {(
                        huevo.confianza * 100
                      ).toFixed(1)}
                      %
                    </Text>

                  </View>
                );
              }
            )}


            {/* SIN DETECCIÓN */}

            {resultado.total_huevos === 0 && (

              <View
                style={styles.sinDeteccion}
              >

                <Text
                  style={styles.sinDeteccionTitulo}
                >
                  No se detectaron huevos
                </Text>

                <Text
                  style={styles.sinDeteccionTexto}
                >
                  Intenta colocar el huevo más
                  centrado dentro del recuadro.
                </Text>

              </View>
            )}

          </View>
        )}


        {/* BOTONES */}

        <TouchableOpacity
          style={styles.botonPrincipal}
          onPress={volverACamara}
        >

          <Text
            style={styles.textoBotonPrincipal}
          >
            📷 Escanear otro huevo
          </Text>

        </TouchableOpacity>


        <TouchableOpacity
          style={styles.botonSecundario}
          onPress={seleccionarImagen}
        >

          <Text
            style={styles.textoBotonSecundario}
          >
            🖼️ Elegir otra imagen
          </Text>

        </TouchableOpacity>

      </ScrollView>

    </SafeAreaView>
  );
}


// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({

  
  container: {
    flex: 1,
    backgroundColor: "#FAF0F0",
  },

  inicio: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },

  iconoPrincipal: {
    fontSize: 70,
    marginBottom: 15,
  },

  titulo: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    color: "#641717",
  },

  subtitulo: {
    fontSize: 16,
    textAlign: "center",
    color: "#7F4F4F",
    marginTop: 10,
    marginBottom: 35,
  },

  botonPrincipal: {
    width: "100%",
    backgroundColor: "#641717",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  textoBotonPrincipal: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
  },

  botonSecundario: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#641717",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },

  textoBotonSecundario: {
    color: "#641717",
    fontSize: 16,
    fontWeight: "bold",
  },

 cameraContainer: {
  flex: 1,
  backgroundColor: "#000000",
},

cameraWrapper: {
  flex: 1,
  position: "relative",
  backgroundColor: "#000000",
},

camera: {
  flex: 1,
  width: "100%",
},

cameraOverlay: {
  ...StyleSheet.absoluteFill,
  justifyContent: "space-between",
  alignItems: "center",
  paddingTop: 25,
  paddingBottom: 35,
},

  indicador: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },

  punto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
  },

  puntoActivo: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4CAF50",
    marginRight: 8,
  },

  textoIndicador: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },

  areaDeteccion: {
    width: "75%",
    height: "40%",
    position: "relative",
  },

  esquina1: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 35,
    height: 35,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#FFFFFF",
  },

  esquina2: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 35,
    height: 35,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: "#FFFFFF",
  },

  esquina3: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 35,
    height: 35,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#FFFFFF",
  },

  esquina4: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 35,
    height: 35,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: "#FFFFFF",
  },

  instrucciones: {
    alignItems: "center",
    paddingHorizontal: 20,
  },

  instruccion: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    textAlign: "center",
  },

  textoAutomatico: {
    color: "#FFFFFF",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  botonCamara: {
    alignItems: "center",
    padding: 10,
  },

  circuloCamara: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  circuloInterior: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "#641717",
  },

  textoTomar: {
    color: "#FFFFFF",
    marginTop: 8,
    fontSize: 15,
    fontWeight: "bold",
  },

  scroll: {
    padding: 20,
    paddingBottom: 40,
  },

  tituloResultado: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    color: "#641717",
    marginBottom: 20,
  },

  imagenContainer: {
    width: "100%",
    height: 300,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 20,
  },

  imagen: {
    width: "100%",
    height: "100%",
  },

  cargando: {
    alignItems: "center",
    padding: 20,
  },

  textoCargando: {
    marginTop: 10,
    fontSize: 16,
    color: "#7F4F4F",
  },

  resumen: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 15,
  },

  tarjeta: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },

  numero: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#641717",
  },

  numeroBueno: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#2E7D32",
  },

  numeroRoto: {
    fontSize: 25,
    fontWeight: "bold",
    color: "#C62828",
  },

  etiqueta: {
    marginTop: 5,
    fontSize: 13,
    color: "#7F4F4F",
  },

  huevoResultado: {
    marginTop: 10,
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },

  huevoTitulo: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#641717",
  },

  bueno: {
    fontSize: 21,
    fontWeight: "bold",
    color: "#2E7D32",
    marginTop: 5,
  },

  roto: {
    fontSize: 21,
    fontWeight: "bold",
    color: "#C62828",
    marginTop: 5,
  },

  confianza: {
    marginTop: 5,
    fontSize: 14,
    color: "#7F4F4F",
  },

  sinDeteccion: {
    marginTop: 10,
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    alignItems: "center",
  },

  sinDeteccionTitulo: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#641717",
  },

  sinDeteccionTexto: {
    textAlign: "center",
    marginTop: 8,
    color: "#7F4F4F",
  },

});
