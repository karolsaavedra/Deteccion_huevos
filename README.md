## Detector de Huevos

# Contexto

El proyecto consiste en desarrollar un sistema capaz de detectar huevos mediante visión por computador y clasificarlos como buenos o rotos.

Para esto se entrenó un modelo de detección de objetos YOLO11n utilizando un dataset preparado con Roboflow. El modelo se integra con una API desarrollada en FastAPI, desplegada en AWS EC2.

La aplicación móvil fue desarrollada con React Native y Expo, permitiendo utilizar la cámara del dispositivo para capturar imágenes de los huevos y enviar estas al modelo para obtener la clasificación.

# Tecnologías

* Python
* YOLO11n
* Ultralytics
* Roboflow
* FastAPI
* AWS EC2
* React Native
* Expo
* TypeScript
* OpenCV

# Funcionamiento

El usuario puede utilizar la cámara de la aplicación para detectar un huevo. La captura puede realizarse manualmente o de forma automática cuando el sistema identifica un huevo.

La imagen se envía al servidor de AWS, donde el modelo analiza la imagen y determina si el huevo corresponde a la categoría Bueno o Roto.

## Integrantes 

Edson Julián Díaz Pinilla

Karol Stefany Saavedra Suárez
