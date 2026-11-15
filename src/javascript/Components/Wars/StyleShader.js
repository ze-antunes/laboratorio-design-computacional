import { Color, Vector3 } from "three";

export const StyleShader = {
  uniforms: {
    cloudOpacity: { value: 1 },
    colorMap: {
      value: [
        new Color("#427062"),
        new Color("#33594e"),
        new Color("#234549"),
        new Color("#1e363f"),
      ],
    },
    brightnessThresholds: {
      value: [0.6, 0.35, 0.001],
    },
    lightPosition: {
      value: new Vector3(15, 15, 15),
    },
  },
  vertexShader: /* glsl */ `
        // Set the precision for data types used in this shader
        precision highp float;
        precision highp int;

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vCloudVisibility;
        #include <fog_pars_vertex>

        #ifdef USE_INSTANCING
          attribute float cloudVisibility;
        #else
          uniform float cloudOpacity;
        #endif
        vec3 normalThrough(mat3 transform,vec3 source) {
          vec3 squaredScale=vec3(dot(transform[0],transform[0]),dot(transform[1],transform[1]),dot(transform[2],transform[2]));
          return transform*(source/max(squaredScale,vec3(0.000001)));
        }
        void main() {
            #ifdef USE_INSTANCING
              vCloudVisibility=cloudVisibility;
            #else
              vCloudVisibility=cloudOpacity;
            #endif
            vec4 localPosition = vec4(position, 1.0);
            vec3 localNormal = normal;
            #ifdef USE_INSTANCING
              localPosition = instanceMatrix * localPosition;
              localNormal = normalThrough(mat3(instanceMatrix),localNormal);
            #endif
            vNormal = normalize(normalThrough(mat3(modelMatrix),localNormal));
            vPosition = (modelMatrix * localPosition).xyz;
            vec4 mvPosition=viewMatrix*vec4(vPosition,1.0);
            gl_Position=projectionMatrix*mvPosition;
            #include <fog_vertex>
        }
    `,
  fragmentShader: /* glsl */ `
        precision highp float;
        precision highp int;

        // Default THREE.js uniforms available to both fragment and vertex shader
        uniform mat4 modelMatrix;

        uniform vec3 colorMap[4];
        uniform float brightnessThresholds[3];
        uniform vec3 lightPosition;

        // variables passed from vertex to fragment shader
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vCloudVisibility;
        #include <fog_pars_fragment>

        void main() {
            // Screen-door dissolve keeps opaque depth correct while revealing
            // the aircraft; it never cuts a geometric hole into a cloud.
            float threshold=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
            if(vCloudVisibility<=threshold)discard;
            vec3 worldPosition = vPosition;
            vec3 worldNormal = normalize(vNormal);
            vec3 lightVector = normalize(lightPosition - worldPosition);
            float brightness = dot(worldNormal, lightVector);

            vec4 final;

            if(brightness > brightnessThresholds[0])
                final = vec4(colorMap[0], 1);
            else if(brightness > brightnessThresholds[1])
                final = vec4(colorMap[1], 1);
            else if(brightness > brightnessThresholds[2])
                final = vec4(colorMap[2], 1);
            else
                final = vec4(colorMap[3], 1);

            gl_FragColor = vec4(final);
            #include <fog_fragment>
        }
    `,
};
